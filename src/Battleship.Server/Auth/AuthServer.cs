using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Battleship.Server.Auth;

/// <summary>Local account service. Gameplay still uses the existing TCP protocol.</summary>
public static class AuthServer
{
    public static WebApplication Create(string url, string databasePath, GameTickets? tickets = null, Action<string>? onLogout = null)
    {
        var builder = WebApplication.CreateSlimBuilder(new WebApplicationOptions { ContentRootPath = AppContext.BaseDirectory });
        builder.WebHost.UseUrls(url);
        builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 16 * 1024);
        builder.Logging.SetMinimumLevel(LogLevel.Warning);
        var directory = Path.GetDirectoryName(Path.GetFullPath(databasePath))!;
        Directory.CreateDirectory(directory);
        builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(directory, "keys")))
            .SetApplicationName("Battleship.Accounts");
        builder.Services.AddDbContext<AuthDbContext>(options => options.UseSqlite(
            new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder { DataSource = databasePath }.ToString()));
        builder.Services.AddIdentityCore<Account>(options =>
        {
            options.User.RequireUniqueEmail = true;
            options.Password.RequiredLength = 8;
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
        }).AddEntityFrameworkStores<AuthDbContext>().AddSignInManager();
        builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme)
            .AddCookie(IdentityConstants.ApplicationScheme, options =>
            {
                options.Cookie.Name = "Battleship.Account";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Strict;
                options.ExpireTimeSpan = TimeSpan.FromHours(8);
                options.SlidingExpiration = false;
                options.Events.OnRedirectToLogin = context => { context.Response.StatusCode = 401; return Task.CompletedTask; };
                options.Events.OnRedirectToAccessDenied = context => { context.Response.StatusCode = 403; return Task.CompletedTask; };
                options.Events.OnValidatePrincipal = SecurityStampValidator.ValidatePrincipalAsync;
            })
            .AddCookie(IdentityConstants.ExternalScheme)
            .AddCookie(IdentityConstants.TwoFactorRememberMeScheme);
        builder.Services.Configure<SecurityStampValidatorOptions>(options => options.ValidationInterval = TimeSpan.Zero);
        builder.Services.AddAuthorization();
        var app = builder.Build();
        using (var scope = app.Services.CreateScope())
            scope.ServiceProvider.GetRequiredService<AuthDbContext>().Database.EnsureCreated();

        var scores = new AccountScores(databasePath);
        scores.Initialize();
        tickets ??= new GameTickets();

        // JSON + a custom header prevents cross-site form submissions; no CORS is enabled.
        app.Use(async (context, next) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            if (HttpMethods.IsPost(context.Request.Method) &&
                (context.Request.Headers["X-Battleship-Request"] != "1" || !context.Request.HasJsonContentType()))
            {
                context.Response.StatusCode = 403;
                return;
            }
            await next(context);
        });
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapPost("/api/auth/register", async (RegisterRequest request, UserManager<Account> users) =>
        {
            var email = request.Email?.Trim();
            var name = request.DisplayName?.Trim();
            if (email is null || email.Length > 254 || !new EmailAddressAttribute().IsValid(email))
                return Results.BadRequest(new { message = "Enter a valid email address." });
            if (string.IsNullOrWhiteSpace(name) || name.Length > 16 || name.Any(char.IsControl))
                return Results.BadRequest(new { message = "Nickname must be 1–16 characters." });
            if (request.Password is null || request.Password.Length > 128)
                return Results.BadRequest(new { message = "Password must be 8–128 characters." });
            var user = new Account { UserName = email, Email = email, DisplayName = name };
            var result = await users.CreateAsync(user, request.Password);
            return result.Succeeded ? Results.Ok(new { message = "Account created. Log in to play." })
                : Results.BadRequest(new { message = string.Join(" ", result.Errors.Select(e => e.Description)) });
        });
        app.MapPost("/api/auth/login", async (LoginRequest request, UserManager<Account> users, SignInManager<Account> signIn) =>
        {
            if (string.IsNullOrWhiteSpace(request.Email) || request.Email.Length > 254 ||
                string.IsNullOrEmpty(request.Password) || request.Password.Length > 128)
                return Results.BadRequest(new { message = "Enter your email and password." });
            var user = await users.FindByEmailAsync(request.Email.Trim());
            var result = user is null ? SignInResult.Failed
                : await signIn.PasswordSignInAsync(user, request.Password, isPersistent: false, lockoutOnFailure: true);
            return result.Succeeded ? Results.Ok(Profile(user!))
                : Results.Json(new { message = "Email or password is incorrect, or the account is temporarily locked. Try again in 5 minutes." }, statusCode: 401);
        });
        app.MapGet("/api/auth/me", async (HttpContext context, UserManager<Account> users) =>
        {
            var user = await users.GetUserAsync(context.User);
            return user is null ? Results.Unauthorized() : Results.Ok(Profile(user));
        }).RequireAuthorization();
        app.MapPost("/api/auth/game-ticket", async (HttpContext context, UserManager<Account> users) =>
        {
            var user = await users.GetUserAsync(context.User);
            return user is null ? Results.Unauthorized()
                : Results.Ok(new { ticket = tickets.Issue(user.Id, user.SecurityStamp!) });
        }).RequireAuthorization();
        app.MapGet("/api/auth/score", async (HttpContext context, UserManager<Account> users) =>
        {
            var user = await users.GetUserAsync(context.User);
            return user is null ? Results.Unauthorized() : Results.Ok(new { score = scores.Load(user.Id), matchesPlayed = scores.LoadMatchesPlayed(user.Id) });
        }).RequireAuthorization();
        app.MapPost("/api/auth/logout", async (HttpContext context, UserManager<Account> users) =>
        {
            var user = await users.GetUserAsync(context.User);
            if (user is not null)
            {
                var updated = await users.UpdateSecurityStampAsync(user);
                if (!updated.Succeeded) return Results.Problem("Could not revoke the account session. Try again.");
                onLogout?.Invoke(user.Id);
            }
            await context.SignOutAsync(IdentityConstants.ApplicationScheme);
            return Results.Ok(new { message = "Logged out." });
        });
        return app;
    }

    private static object Profile(Account user) => new { id = user.Id, email = user.Email, displayName = user.DisplayName };
    public sealed record RegisterRequest(string? Email, string? Password, string? DisplayName);
    public sealed record LoginRequest(string? Email, string? Password);
}
