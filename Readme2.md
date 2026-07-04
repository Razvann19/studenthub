# Baragan Constantin Razvan StudentHUB CTI Licenta

# StudentHUB — Platformă web colaborativă pentru studenții UPT

## Descriere

StudentHUB este o aplicație web destinată studenților Universității Politehnica Timișoara, cu scopul de a centraliza comunicarea academică, accesul la cursuri, schimbul de notițe și utilizarea unui asistent AI conversațional (Nova).

## Repository

**GitHub:** https://github.com/Razvann19/studenthub

> Vizibilitate: publică

---

## Stack tehnologic

| Componentă | Tehnologie |
|---|---|
| Frontend | Angular 19 |
| Backend | ASP.NET Core 9 (.NET 9) |
| Bază de date | SQL Server 2022 |
| Comunicare timp real | SignalR |
| Autentificare | Microsoft Entra ID (MSAL) |
| Asistent AI | Anthropic Claude API (claude-sonnet-4-6) |
| Containerizare | Docker Compose |
| Reverse proxy | Nginx |
| Hosting | Hetzner Cloud (CPX22) |

---

## Pași de compilare

### Cerințe prealabile

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9)
- [Node.js 22+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Angular CLI](https://angular.io/cli): `npm install -g @angular/cli`

### Compilare backend (ASP.NET Core)

```bash
cd studenthub-backend/StudentHub.API
dotnet restore
dotnet build
```

### Compilare frontend (Angular)

```bash
cd studenthub-frontend
npm install
ng build --configuration=production
```

---

## Pași de instalare și lansare

### Varianta 1 — Docker Compose (recomandat)

#### 1. Clonare repository

```bash
git clone https://github.com/Razvann19/studenthub.git
cd studenthub
```

#### 2. Configurare variabile de mediu

Creează fișierul `.env` în rădăcina proiectului:

```env
DB_PASSWORD=StudentHub@2024!
ANTHROPIC_API_KEY=anthropic_api_key
```

Configurează `studenthub-backend/StudentHub.API/appsettings.Production.json`:

```json
{
  "ConnectionStrings": {
    "Default": "Server=db,1433;Database=StudentHubDB;User Id=sa;Password=StudentHub@2024!;TrustServerCertificate=True"
  },
  "AzureAd": {
    "Instance": "https://login.microsoftonline.com/",
    "Domain": "student.upt.ro",
    "TenantId": "tenant_id",
    "ClientId": "client_id",
    "Scopes": "access_as_student"
  },
  "Anthropic": {
    "ApiKey": "anthropic_api_key"
  }
}
```

#### 3. Pornire aplicație

```bash
docker compose up -d --build
```

#### 4. Acces aplicație

| Serviciu | URL |
|---|---|
| Frontend (studenți) | http://localhost |
| Backend API | http://localhost:8080 |
| Admin Panel | http://localhost:8080/admin |

**Credențiale admin implicite:**
- Email: `admin@studenthub.ro`
- Parolă: `Admin1234!`

---

### Varianta 2 — Rulare locală fără Docker

#### Backend

```bash
cd studenthub-backend/StudentHub.API
# Configurează appsettings.Development.json cu connection string local
dotnet ef database update
dotnet run
```

#### Frontend

```bash
cd studenthub-frontend
npm install
ng serve
```

Frontend disponibil la: `http://localhost:4200`

---

## Structura proiectului
studenthub/

├── studenthub-frontend/          # Angular 19

│   └── src/app/

│       ├── pages/                # Componente pagini

│       │   ├── courses/          # Cursuri și chat cursuri

│       │   ├── cantina/          # Chat cantină

│       │   ├── activities/       # Activități și sondaje

│       │   └── nova/             # Asistent AI Nova

│       └── services/             # Servicii HTTP și SignalR

├── studenthub-backend/

│   └── StudentHub.API/

│       ├── Controllers/          # REST API controllers

│       ├── Hubs/                 # SignalR Hubs (Chat, Course, Activity)

│       ├── Models/               # Entități și DTO-uri

│       ├── Services/             # Logică aplicație

│       ├── Pages/                # Razor Pages (Admin Panel)

│       └── Migrations/           # EF Core migrations

└── docker-compose.yml


---

## Funcționalități principale

- **Autentificare** prin cont instituțional Microsoft (@student.upt.ro)
- **Cursuri** filtrate după profil academic (secție, an, semestru)
- **Chat în timp real** cu SignalR — reply, reacții, editare, moderare
- **Notițe și atașamente** — PDF/DOCX cu extragere automată de text
- **Cantina** — chat general cu intervale estimative de așteptare
- **Activități** — chat și sondaje colaborative
- **Nova AI** — asistent bazat pe Claude, cu suport pentru notițe și documente
- **Admin Panel** — moderare, gestionare cursuri și activități

---

## Demo live

**https://studenthub-upt.duckdns.org**

---

## Autor

**Bărăgan Constantin-Răzvan**  
Universitatea Politehnica Timișoara  
Facultatea de Automatică și Calculatoare — CTI  
Coordonator: Conf. Dr. Ing. Alexandru Iovanovici  
Lucrare de licență, 2026



