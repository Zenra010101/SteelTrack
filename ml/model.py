"""TensorFlow / Keras 3 LSTM Demand Forecasting Model.

Uses keras.layers.LSTM from keras/src/layers/rnn/lstm.py.
"""

from __future__ import annotations

import keras
from keras.layers import Dense, Dropout, Input, LSTM


def build_lstm_model(
    lookback: int = 12,
    horizon: int = 3,
    hidden_units: tuple[int, int] = (64, 32),
    dropout: float = 0.1,
    learning_rate: float = 1e-3,
) -> keras.Model:
    """Build a stacked LSTM model producing a multi-step demand forecast.

    Args:
        lookback: Number of past months in the input sequence.
        horizon: Number of future months to predict.
        hidden_units: Tuple of LSTM hidden units for layer 1 and layer 2.
        dropout: Dropout rate applied across recurrent and dense layers.
        learning_rate: Adam optimizer learning rate.

    Returns:
        Compiled Keras Model.
    """
    model = keras.Sequential(
        [
            Input(shape=(lookback, 1), name="monthly_demand_input"),
            # Primary recurrent sequence extractor
            LSTM(
                hidden_units[0],
                return_sequences=True,
                dropout=dropout,
                recurrent_dropout=0.0,
                name="lstm_layer_1",
            ),
            # Secondary sequence aggregator
            LSTM(
                hidden_units[1],
                return_sequences=False,
                dropout=dropout,
                recurrent_dropout=0.0,
                name="lstm_layer_2",
            ),
            Dense(32, activation="relu", name="dense_projection"),
            Dropout(dropout, name="dropout"),
            # Output dense projection: horizon-step demand forecast
            Dense(horizon, activation="linear", name="demand_forecast_head"),
        ],
        name="SteelTrack_Keras_LSTM",
    )

    # Huber loss is used because steel demand often has project spikes
    # Huber loss is quadratic for small errors and linear for large outliers
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss=keras.losses.Huber(delta=1.0),
        metrics=["mae", "mse"],
    )
    return model

