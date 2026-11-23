import { Icon } from '../ui/icons';
import { back } from '../ui/router';

/** Who to write to about privacy. Empty until Josh picks an address; the Contact section shows once it's set. */
export const PRIVACY_CONTACT = '';
export const PRIVACY_UPDATED = '23 November 2026';

const H = ({ children }: { children: React.ReactNode }) => <h2 style={{ marginTop: 'var(--sp-6)' }}>{children}</h2>;
const P = ({ children }: { children: React.ReactNode }) => <p className="m" style={{ marginTop: 'var(--sp-2)', fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-body)' }}>{children}</p>;
const L = ({ items, ink }: { items: React.ReactNode[]; ink?: string }) => <ul className="m" style={{ color: ink, marginTop: 'var(--sp-2)', paddingLeft: 'var(--sp-5)', fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-body)' }}>{items.map((x, i) => <li key={i} style={{ marginTop: 'var(--sp-1)' }}>{x}</li>)}</ul>;

/* #/privacy: what PalDex keeps, where, who sees it, and how to delete it. Plain words; reachable without a pet
   (from the Welcome screen and the account form) and from Settings. Keep it true: when the app starts sending data
   somewhere new, this page changes in the same pull request. */
export function Privacy() {
  return <div className="screen">
    <div className="row" style={{ marginTop: 'var(--sp-3)' }}><button className="iconbtn" aria-label="Back" onClick={() => back('home')}><Icon name="back" /></button><h1 className="sp">Privacy</h1></div>
    <p className="s" style={{ marginTop: 'var(--sp-1)' }}>Last updated {PRIVACY_UPDATED}</p>

    <div className="card mint" style={{ marginTop: 'var(--sp-4)' }}>
      <b style={{ color: 'var(--teal-ink)' }}>The short version</b>
      <L items={[
        'PalDex keeps your cat’s care records so you, and the people you live with, can look after them together.',
        'No ads, no analytics, no tracking. Your data is never sold or used for anything else.',
        'You can download a backup, and delete your account, any time in Settings.',
      ]} ink="var(--teal-ink)" />
    </div>

    <H>Without an account</H>
    <P>Everything stays in this browser on this phone: your cats, their health log, training, treats and any documents you add. Nothing about you or your cats is sent anywhere (the lettering and food barcode lookups below still use the internet). Clearing the browser’s website data, or deleting the Home Screen app, removes it.</P>

    <H>With an account</H>
    <P>Making an account copies your data to PalDex’s database (run by Supabase) so it syncs between phones and with your household. It stores:</P>
    <L items={[
      <><b>Your account:</b> your email address and password (stored scrambled, never readable), and the name you give yourself.</>,
      <><b>Your cats:</b> name, look, boy or girl, birthday, home date, microchip number, neutered or spayed, meals a day.</>,
      <><b>Their logs:</b> meals, litter, play and daily checks, weight, symptoms, grooming, medicine and vaccines, vet visits and food notes, and training sets, with who logged each one and when.</>,
      <><b>Vets:</b> the vet contacts you save for your household.</>,
      <><b>Documents:</b> vet records and bills you add (PDFs and photos), in private storage. Their text is read on your phone, not sent to anyone to read.</>,
      <><b>Photos:</b> pet photos you post, with their captions, and the paws people give them.</>,
      <><b>Friends:</b> your friend code, the name friends see, who you’re friends with, friend requests, and treats and thank-yous between friends.</>,
      <><b>Notifications:</b> if you turn them on, your browser’s notification address, your time zone and quiet hours.</>,
    ]} />

    <H>Who can see it</H>
    <L items={[
      <><b>Your household</b> (the people you invited, or who invited you) sees and edits every cat in it: their logs, documents, vets and photos.</>,
      <><b>Friends</b> see each cat’s card (name, look, a few training highlights) and the photos posted of it. Never the health log, documents or vets.</>,
      <><b>Nobody else.</b> The database refuses everyone else, row by row. The people who run PalDex can reach the database to keep it working; they don’t look through it or share it.</>,
    ]} />

    <H>Services PalDex uses</H>
    <L items={[
      <><b>Supabase</b> stores accounts, the database and files.</>,
      <><b>Cloudflare</b> serves the app itself (the code, not your data).</>,
      <><b>Google Fonts</b> supplies the lettering: your browser fetches it from Google, which sees that request.</>,
      <><b>Open Pet Food Facts</b> gets a food’s barcode number when you scan one, to look up the food. Nothing else is sent.</>,
      <><b>Your browser’s push service</b> (Apple, Google or Mozilla) carries notifications, only if you turn them on.</>,
      <>Google Calendar and Apple Maps open only when you tap “Add to calendar” or a vet’s address.</>,
    ]} />
    <P>No cookies are used for tracking. The app keeps your data and your sign-in in this browser’s own storage.</P>

    <H>How long it’s kept</H>
    <P>Until you delete it. Deleting a log entry leaves a blank marker for a while so the delete reaches the other phones in your household. Deleting a photo or document removes the file.</P>

    <H>Deleting your account</H>
    <P>Settings → Household & account → Delete my account. It deletes, for good: your account and email, your friends and requests, the photos you posted, and any cat nobody else looks after, with everything stored for it. Cats you share stay with your household, with their history; entries you logged stay without your name. Then everything is removed from this phone too.</P>

    {PRIVACY_CONTACT && <><H>Questions</H><P>Write to {PRIVACY_CONTACT}. If this page changes, the date at the top changes too.</P></>}
    <div style={{ height: 'var(--sp-8)' }} />
  </div>;
}
