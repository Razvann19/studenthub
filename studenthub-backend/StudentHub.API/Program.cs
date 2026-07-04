using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Web;
using StudentHub.API.Data;
using StudentHub.API.Hubs;
using StudentHub.API.Models.Entities;
using StudentHub.API.Services;
using StudentHub.API.Services.Interfaces;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddRazorPages();
builder.Services.AddSignalR();
builder.Services.AddSingleton<NoteIdService>();
builder.Services.AddHttpClient();
builder.Services.AddSingleton<OnlineTracker>();
builder.Services.AddSingleton<BadWordService>();
builder.Services.AddSingleton<TextExtractionService>();
builder.Services.AddScoped<HubUserService>();

builder.Services.Configure<Microsoft.AspNetCore.Mvc.MvcOptions>(options =>
{
    options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
});

builder.Services.Configure<RouteOptions>(options =>
{
    options.LowercaseUrls = false;
    options.AppendTrailingSlash = false;
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("Default"),
        sqlOptions =>
        {
            sqlOptions.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(10),
                errorNumbersToAdd: null);
        }));

builder.Services.AddIdentity<IdentityUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequiredLength = 4;
    options.Password.RequireUppercase = false;
    options.Password.RequireNonAlphanumeric = false;
    options.SignIn.RequireConfirmedAccount = false;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders()
.AddDefaultUI();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/Identity/Account/Login";
    options.LogoutPath = "/Identity/Account/Logout";
    options.AccessDeniedPath = "/Identity/Account/Login";
    options.Cookie.Name = "StudentHubAdmin";
    options.ExpireTimeSpan = TimeSpan.FromHours(8);

    options.Events.OnRedirectToLogin = context =>
    {
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.StatusCode = 401;
            return Task.CompletedTask;
        }
        context.Response.Redirect(context.RedirectUri);
        return Task.CompletedTask;
    };

    options.Events.OnRedirectToReturnUrl = context =>
    {
        context.Response.Redirect("/Admin/Index");
        return Task.CompletedTask;
    };
});

builder.Services.AddScoped<IAuthService, AuthService>();

builder.Services.AddAuthentication()
    .AddMicrosoftIdentityWebApi(
        builder.Configuration.GetSection("AzureAd"),
        jwtBearerScheme: "Entra"
    );
builder.Services.Configure<JwtBearerOptions>("Entra", options =>
{
    var originalOnMessageReceived = options.Events?.OnMessageReceived;
    options.Events ??= new JwtBearerEvents();
    options.Events.OnMessageReceived = context =>
    {
        var accessToken = context.Request.Query["access_token"];
        var path = context.HttpContext.Request.Path;
        if (!string.IsNullOrEmpty(accessToken) &&
            (path.StartsWithSegments("/hubs/chat") ||
             path.StartsWithSegments("/hubs/course") ||
             path.StartsWithSegments("/hubs/activity")))
        {
            context.Token = accessToken;
        }
        return originalOnMessageReceived?.Invoke(context) ?? Task.CompletedTask;
    };
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200", "http://localhost", "https://studenthub-upt.duckdns.org")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    if (!await roleManager.RoleExistsAsync("Admin"))
        await roleManager.CreateAsync(new IdentityRole("Admin"));

    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
    var adminUser = await userManager.FindByEmailAsync("admin@studenthub.ro");
    if (adminUser == null)
    {
        adminUser = new IdentityUser
        {
            UserName = "admin@studenthub.ro",
            Email = "admin@studenthub.ro",
            EmailConfirmed = true
        };
        await userManager.CreateAsync(adminUser, "Admin1234!");
        await userManager.AddToRoleAsync(adminUser, "Admin");
    }
    else if (!await userManager.IsInRoleAsync(adminUser, "Admin"))
    {
        await userManager.AddToRoleAsync(adminUser, "Admin");
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAngular");
if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseStaticFiles();

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(builder.Environment.ContentRootPath, "Uploads")
    ),
    RequestPath = "/uploads"
});

Directory.CreateDirectory(Path.Combine(builder.Environment.ContentRootPath, "Uploads", "attachments"));
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(builder.Environment.ContentRootPath, "Uploads", "attachments")
    ),
    RequestPath = "/uploads/attachments"
});

Directory.CreateDirectory(Path.Combine(builder.Environment.ContentRootPath, "Uploads", "profiles"));
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(builder.Environment.ContentRootPath, "Uploads", "profiles")
    ),
    RequestPath = "/profiles"
});

app.UseRouting();

app.Use((context, next) =>
{
    context.Request.Scheme = "https";
    return next();
});

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/admin", (HttpContext ctx) =>
    ctx.User.Identity?.IsAuthenticated == true
        ? Results.Redirect("/Admin/Index")
        : Results.Redirect("/Identity/Account/Login"));

app.MapGet("/admin/dashboard", (HttpContext ctx) =>
    Results.Redirect("/Admin/Index"));

app.MapControllers();
app.MapRazorPages();
app.MapHub<StudentHub.API.Hubs.ChatHub>("/hubs/chat");
app.MapHub<StudentHub.API.Hubs.CourseHub>("/hubs/course");
app.MapHub<StudentHub.API.Hubs.ActivityHub>("/hubs/activity");

app.MapGet("/", (HttpContext ctx) =>
    ctx.User.Identity?.IsAuthenticated == true
        ? Results.Redirect("/admin")
        : Results.Redirect("/Identity/Account/Login"));

app.Run();