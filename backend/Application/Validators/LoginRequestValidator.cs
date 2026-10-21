using FluentValidation;
using GensanPOS.Application.DTOs.Auth;

namespace GensanPOS.Application.Validators;

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().WithMessage("Username or email is required.");
        RuleFor(x => x.Password).NotEmpty().WithMessage("Password is required.");
    }
}
