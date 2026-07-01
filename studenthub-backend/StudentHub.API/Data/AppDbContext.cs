using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Models.Entities;

namespace StudentHub.API.Data;

public class AppDbContext : IdentityDbContext<IdentityUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
    public DbSet<User> Students { get; set; }
    public DbSet<HomeCard> HomeCards { get; set; }
    public DbSet<Message> Messages { get; set; }
    public DbSet<MessageReaction> MessageReactions { get; set; }
    public DbSet<AcademicOption> AcademicOptions { get; set; }
    public DbSet<Course> Courses { get; set; }
    public DbSet<Note> Notes { get; set; }
    public DbSet<NoteReaction> NoteReactions { get; set; }
    public DbSet<Activity> Activities { get; set; }
    public DbSet<Poll> Polls { get; set; }
    public DbSet<PollOption> PollOptions { get; set; }
    public DbSet<PollVote> PollVotes { get; set; }
    public DbSet<AiConversation> AiConversations { get; set; }
    public DbSet<AiMessage> AiMessages { get; set; }
    public DbSet<UserRoomLastSeen> UserRoomLastSeen { get; set; }
    
    public DbSet<MessageReport> MessageReports { get; set; }
    public DbSet<BadWord> BadWords { get; set; }

    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.EntraObjectId).IsUnique().HasFilter("[EntraObjectId] IS NOT NULL");
            entity.Property(e => e.Email).IsRequired().HasMaxLength(255);
            entity.Property(e => e.FullName).IsRequired().HasMaxLength(255);
            entity.Property(e => e.StudyType).HasMaxLength(10);
            entity.Property(e => e.EntraObjectId).HasMaxLength(36);
        });

        modelBuilder.Entity<HomeCard>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Section).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Icon).IsRequired().HasMaxLength(10);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(255);
            entity.Property(e => e.Description).IsRequired().HasMaxLength(1000);
            entity.HasIndex(e => new { e.Section, e.Order });
        });
    
        modelBuilder.Entity<Message>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Room).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Text).HasMaxLength(1000);
            entity.Property(e => e.WaitInterval).HasMaxLength(20);
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.Room, e.CreatedAt });
        });
    
        modelBuilder.Entity<MessageReaction>(entity =>
        {
            entity.ToTable("MessageReactions");
            entity.HasKey(e => e.Id);
        
            // Configurare explicită a foreign key fără navigation property
            entity.Property(e => e.MessageId)
                .HasColumnName("MessageId");
        
            entity.HasIndex(e => new { e.MessageId, e.UserId, e.Emoji }).IsUnique();
        });
        
        modelBuilder.Entity<AcademicOption>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.StudyType).IsRequired().HasMaxLength(20);
            entity.Property(e => e.Value).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Years).IsRequired();
            entity.HasIndex(e => new { e.StudyType, e.Order });
        });
        
        modelBuilder.Entity<Course>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.StudyType).IsRequired().HasMaxLength(20);
            entity.Property(e => e.Section).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(255);
            entity.HasIndex(e => new { e.StudyType, e.Section, e.Year, e.Order });
        });
        
        modelBuilder.Entity<Note>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Text).IsRequired(false).HasMaxLength(2000); // ← IsRequired(false)
            entity.HasOne(e => e.Course)
                .WithMany()
                .HasForeignKey(e => e.CourseId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasIndex(e => new { e.CourseId, e.CreatedAt });
        });

        modelBuilder.Entity<NoteReaction>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.NoteId).HasColumnName("NoteId");
            entity.HasIndex(e => new { e.NoteId, e.UserId, e.Emoji }).IsUnique();
        });
        
        modelBuilder.Entity<Activity>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => e.Order);
        });
        
        modelBuilder.Entity<Poll>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Question).IsRequired().HasMaxLength(500);
            entity.Property(e => e.UserName).IsRequired().HasMaxLength(255);
            entity.HasOne(e => e.Activity)
                .WithMany()
                .HasForeignKey(e => e.ActivityId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.ActivityId, e.CreatedAt });
        });

        modelBuilder.Entity<PollOption>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Text).IsRequired().HasMaxLength(200);
            entity.Property(e => e.AddedByUserName).IsRequired().HasMaxLength(255);
            entity.HasOne(e => e.Poll)
                .WithMany(p => p.Options)
                .HasForeignKey(e => e.PollId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PollVote>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserName).IsRequired().HasMaxLength(255);
            entity.HasOne(e => e.Option)
                .WithMany(o => o.Votes)
                .HasForeignKey(e => e.PollOptionId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.PollId, e.UserId }).IsUnique();
        });
        
        modelBuilder.Entity<AiConversation>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).HasMaxLength(200);
            entity.Property(e => e.Category).HasMaxLength(20);
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => new { e.UserId, e.UpdatedAt });
        });

        modelBuilder.Entity<AiMessage>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Role).IsRequired().HasMaxLength(20);
            entity.Property(e => e.Content).IsRequired();
            entity.HasOne(e => e.Conversation)
                .WithMany(c => c.Messages)
                .HasForeignKey(e => e.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Note>(entity =>
        {
            entity.Property(e => e.NoteId).HasMaxLength(20);
            entity.HasIndex(e => e.NoteId).IsUnique();
        });
        
        modelBuilder.Entity<UserRoomLastSeen>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.RoomId }).IsUnique();
            entity.Property(e => e.RoomId).HasMaxLength(50).IsRequired();
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        modelBuilder.Entity<MessageReport>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.MessageId, e.UserId }).IsUnique();
            entity.HasOne(e => e.Message)
                .WithMany(m => m.Reports)
                .HasForeignKey(e => e.MessageId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.NoAction);
        });
    }
}