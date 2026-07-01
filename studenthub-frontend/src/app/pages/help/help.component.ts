import {Component, inject, signal} from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-help',
  standalone: true,
  templateUrl: './help.component.html',
  styleUrl: './help.component.scss',
})
export class HelpComponent {
  private router = inject(Router);
  openIndex = signal<number | null>(0);

  goHome(): void {
    this.router.navigate(['/home']);
  }

  toggle(i: number): void {
    this.openIndex.set(this.openIndex() === i ? null : i);
  }

  faqs = [
    {
      q: 'Cum mă conectez la StudentHub?',
      a: 'Apasă pe „Intră în platformă" pe pagina principală și autentifică-te cu contul tău de student UPT (adresa @student.upt.ro), folosind aceeași parolă ca pe e-mailul instituțional.'
    },
    {
      q: 'De ce nu pot să trimit mesaje în chat?',
      a: 'Verifică indicatorul de conexiune din header-ul chat-ului (punctul verde/gri). Dacă apare gri, conexiunea s-a întrerupt — încearcă să dai refresh la pagină.'
    },
    {
      q: 'Cum adaug o notiță cu fișier atașat?',
      a: 'Intră în chat-ul cursului tău, mergi la tab-ul „Notițe", apasă pe iconița 📎 din zona de scriere, alege fișierul (max 20MB) și apasă send.'
    },
    {
      q: 'Cum schimb secția sau anul de studiu?',
      a: 'Mergi în Profil → Editează profilul → Date academice și actualizează secția sau anul. Modificarea se aplică imediat în toate paginile.'
    },
    {
      q: 'Ce fac dacă văd un mesaj nepotrivit?',
      a: 'Apasă pe săgeata din colțul mesajului și alege „Raportează". Mesajul va fi trimis echipei de moderare pentru verificare.'
    },
    {
      q: 'Ce este Nova și cum o folosesc?',
      a: 'Nova este asistentul AI al platformei. O găsești prin butonul rotund din colțul din dreapta jos al dashboard-ului. Poți pune întrebări rapide direct acolo sau deschide conversația completă pentru context extins.'
    },
    {
      q: 'Datele mele sunt în siguranță?',
      a: 'Da. Accesul se face exclusiv prin contul tău instituțional UPT, iar datele sunt stocate conform politicii noastre de confidențialitate. Vezi pagina de Confidențialitate pentru detalii.'
    },
  ];
}
