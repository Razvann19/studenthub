# StudentHUB — Platformă web colaborativă pentru studenții UPT

StudentHUB este o aplicație web destinată studenților Universității Politehnica Timișoara, cu scopul de a centraliza comunicarea academică, accesul la cursuri, schimbul de notițe și utilizarea unui asistent AI.

## 🚀 Features

- **Autentificare** prin cont instituțional Microsoft (@student.upt.ro) via Entra ID
- **Cursuri** — lista disciplinelor filtrată după profil academic (secție, an, tip studiu, semestru)
- **Chat în timp real** — SignalR cu suport pentru reply, reacții emoji, editare, ștergere și moderare
- **Notițe și atașamente** — upload PDF/DOCX/imagini cu extragere automată de text
- **Cantina** — chat general cu intervale estimative de așteptare
- **Activități** — spații colaborative cu chat și sondaje
- **Nova AI** — asistent conversațional bazat pe Anthropic Claude, cu suport pentru notițe (NOTE-XXXXXXXX)
- **Admin Panel** — moderare mesaje, gestionare cursuri, activități și cuvinte interzise

## 🛠️ Stack tehnic

| Componentă | Tehnologie |
|---|---|
| Frontend | Angular 19 |
| Backend | ASP.NET Core 9 |
| Bază de date | SQL Server 2022 |
| Real-time | SignalR |
| Autentificare | Microsoft Entra ID (MSAL) |
| AI | Anthropic Claude API |
| Containerizare | Docker Compose |
| Hosting | Hetzner Cloud (CPX22) |

## 📦 Rulare locală

### Cerințe
- Docker Desktop
- Node.js 22+
- .NET 9 SDK

### Pași

```bash
# Clonează repository-ul
git clone https://github.com/Razvann19/studenthub.git
cd studenthub

# Pornește toate serviciile
docker compose up -d --build
```

Aplicația va fi disponibilă la:
- **Frontend**: http://localhost
- **Backend**: http://localhost:8080
- **Admin Panel**: http://localhost:8080/admin

### Variabile de mediu

Creează un fișier `.env` în rădăcina proiectului:

```env
DB_PASSWORD=StudentHub@2024!
ANTHROPIC_API_KEY=your_api_key_here
AZURE_CLIENT_ID=your_client_id
AZURE_TENANT_ID=your_tenant_id
```

## 🗄️ Structura proiectului
studenthub/

├── studenthub-frontend/     # Angular 19

│   └── src/app/

│       ├── pages/           # Componente pagini

│       └── services/        # Servicii HTTP și SignalR

├── studenthub-backend/

│   └── StudentHub.API/

│       ├── Controllers/     # REST API

│       ├── Hubs/            # SignalR Hubs

│       ├── Models/          # Entități

│       ├── Services/        # Logică business

│       └── Pages/           # Razor Pages Admin

└── docker-compose.yml


## 🌐 Demo

Aplicația este disponibilă live la: **https://studenthub-upt.duckdns.org**

## 👤 Autor

**BARAGAN CONSTANTIN RAZVAN**  
Universitatea Politehnica Timișoara  
Facultatea de Automatică și Calculatoare — CTI  
Lucrare de licență, 2026
