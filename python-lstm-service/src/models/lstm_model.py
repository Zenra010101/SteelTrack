"""PyTorch LSTM model for per-series monthly demand forecasting.

Architecture
------------
    Input  : [Batch, SeqLen, 1]  scaled monthly quantities
    LSTM   : hidden=64, layers=2, dropout=0.1
    Head   : Linear(64 -> 32) -> ReLU -> Dropout -> Linear(32 -> Horizon * 2)
    Output : [Batch, Horizon, 2]  -> (mu, log_sigma) per horizon step

The model emits the mean and log-standard-deviation of a Gaussian
predictive distribution rather than a bare point forecast. That is what
makes the confidence intervals in the .NET UI *calibrated* instead of
ad-hoc percentage bands.

The Gaussian NLL loss is
    L = 0.5 * log(sigma^2) + 0.5 * ((y - mu) / sigma)^2 + const
which naturally penalises over-confident errors.
"""

from __future__ import annotations

import torch
import torch.nn as nn


class LSTMDemandModel(nn.Module):
    """Sequence model producing a Gaussian forecast over a fixed horizon."""

    def __init__(
        self,
        *,
        input_size: int = 1,
        hidden_size: int = 64,
        num_layers: int = 2,
        dropout: float = 0.1,
        horizon: int = 3,
        head_hidden: int = 32,
    ) -> None:
        super().__init__()
        self.horizon = horizon
        self.hidden_size = hidden_size

        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0.0,
            batch_first=True,
        )
        self.head = nn.Sequential(
            nn.Linear(hidden_size, head_hidden),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(head_hidden, horizon * 2),
        )

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """Run the model.

        Args:
            x: Tensor of shape [Batch, SeqLen, input_size].

        Returns:
            (mu, sigma) each of shape [Batch, horizon], where sigma is
            clamped to a positive range for numerical stability.
        """
        out, _ = self.lstm(x)
        # Use the final hidden state of the sequence.
        last_hidden = out[:, -1, :]
        raw = self.head(last_hidden)

        mu = raw[:, : self.horizon]
        log_sigma = raw[:, self.horizon :]

        # Clamp log_sigma to keep sigma within a sane range and avoid
        # exploding NLL when the network is early in training.
        log_sigma = torch.clamp(log_sigma, min=-6.0, max=3.0)
        sigma = torch.exp(log_sigma)

        return mu, sigma

    @torch.no_grad()
    def predict(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """Inference-mode forward pass (eval + no_grad)."""
        self.eval()
        return self.forward(x)


def gaussian_nll_loss(
    mu: torch.Tensor,
    sigma: torch.Tensor,
    target: torch.Tensor,
    mask: torch.Tensor | None = None,
) -> torch.Tensor:
    """Negative log-likelihood of the Gaussian predictive distribution.

    Args:
        mu:     [Batch, horizon] predicted means.
        sigma:  [Batch, horizon] predicted standard deviations.
        target: [Batch, horizon] ground-truth values.
        mask:   optional [Batch, horizon] 0/1 mask for missing targets.

    Returns:
        Scalar mean NLL (lower is better).
    """
    if mask is None:
        mask = torch.ones_like(target)

    var = sigma.clamp(min=1e-6) ** 2
    nll = 0.5 * torch.log(var) + 0.5 * (target - mu) ** 2 / var

    # Weighted mean over observed positions only.
    total = (nll * mask).sum()
    count = mask.sum().clamp(min=1.0)
    return total / count


def mae_loss(mu: torch.Tensor, target: torch.Tensor, mask: torch.Tensor | None = None) -> torch.Tensor:
    """Mean absolute error — reported alongside NLL for interpretability."""
    if mask is None:
        mask = torch.ones_like(target)
    abs_err = torch.abs(mu - target) * mask
    return abs_err.sum() / mask.sum().clamp(min=1.0)
