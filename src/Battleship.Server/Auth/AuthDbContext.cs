using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Battleship.Server.Auth;

public sealed class Account : IdentityUser
{
    public string DisplayName { get; set; } = "";
}

public sealed class AuthDbContext(DbContextOptions<AuthDbContext> options) : IdentityDbContext<Account>(options);
