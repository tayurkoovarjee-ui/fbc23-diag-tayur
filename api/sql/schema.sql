-- Safe to run more than once. The API runs this file on startup.

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Users (
    Id           INT IDENTITY(1,1) CONSTRAINT PK_Users PRIMARY KEY,
    Email        NVARCHAR(255) NOT NULL CONSTRAINT UQ_Users_Email UNIQUE,
    PasswordHash NVARCHAR(100) NOT NULL,
    CreatedAt    DATETIME2(0)  NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME()
  );
END;

IF OBJECT_ID(N'dbo.Tasks', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Tasks (
    Id          INT IDENTITY(1,1) CONSTRAINT PK_Tasks PRIMARY KEY,
    UserId      INT            NOT NULL CONSTRAINT FK_Tasks_Users REFERENCES dbo.Users(Id) ON DELETE CASCADE,
    Title       NVARCHAR(200)  NOT NULL,
    Description NVARCHAR(2000) NULL,
    DueDate     DATE           NULL,
    Status      VARCHAR(20)    NOT NULL CONSTRAINT DF_Tasks_Status DEFAULT 'todo',
    CreatedAt   DATETIME2(0)   NOT NULL CONSTRAINT DF_Tasks_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2(0)   NOT NULL CONSTRAINT DF_Tasks_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Tasks_Status CHECK (Status IN ('todo', 'in_progress', 'done')),
    CONSTRAINT CK_Tasks_Title CHECK (LEN(LTRIM(RTRIM(Title))) > 0)
  );

  CREATE INDEX IX_Tasks_User_Status ON dbo.Tasks (UserId, Status);
END;
