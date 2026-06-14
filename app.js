const EMAIL_AUTORIZZATE = [
    "pietro.procopio@gmail.com",
    "romina.maschini@gmail.com",
    "procopio.matteo1@gmail.com",
    "nikywizzy@gmail.com"
];

const auth = firebase.auth();
const db   = firebase.database();
const prodottiRef = db.ref("prodotti");

const CATEGORIE_ORDER = [
    "Frutta e Verdura","Carne e Pesce","Latticini","Pane e Dolci",
    "Bevande","Pulizia Casa","Igiene Personale","Altro"
];
const CAT_EMOJI = {
    "Frutta e Verdura":"🥦","Carne e Pesce":"🥩","Latticini":"🧀",
    "Pane e Dolci":"🍞","Bevande":"🥤","Pulizia Casa":"🧹",
    "Igiene Personale":"🧴","Altro":"📦"
};

function loginGoogle() {
    auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
        .catch(() => {
            document.getElementById("login-error").textContent = "Errore di accesso. Riprova.";
        });
}

function logout() { 
    prodottiRef.off();
    auth.signOut(); 
}

// 1. FUNZIONE PER ATTIVARE IL LISTENER DEI PRODOTTI (Ottimizzata Offline)
function avviaListenerProdotti() {
    prodottiRef.on("value",
        snapshot => {
            const prodotti = [];
            snapshot.forEach(child => {
                const val = child.val();
                if (!val.categoria || !CATEGORIE_ORDER.includes(val.categoria)) {
                    val.categoria = "Altro";
                }
                prodotti.push({ id: child.key, ...val });
            });
            prodotti.sort((a, b) => {
                if (a.acquistato !== b.acquistato) return a.acquistato ? 1 : -1;
                return (a.timestamp || 0) - (b.timestamp || 0);
            });
            renderTabella(prodotti);
        },
        err => {
            console.error("DB errore:", err.message);
            setStatus("⚠️ Modalità offline attiva (dati locali)", false);
        }
    );
}

// 2. GESTIONE ACCESSO OTTIMIZZATA PER L'OFFLINE
auth.onAuthStateChanged(user => {
    const loginScreen = document.getElementById("login-screen");
    const appScreen   = document.getElementById("app-screen");
    const loginError  = document.getElementById("login-error");

    if (user) {
        if (user.email && !EMAIL_AUTORIZZATE.includes(user.email)) {
            loginError.textContent = "⛔ Account non autorizzato.";
            auth.signOut();
            return;
        }
        loginScreen.style.display = "none";
        appScreen.style.display   = "block";
        document.getElementById("user-name").textContent = user.displayName || user.email;
        const photo = document.getElementById("user-photo");
        if (user.photoURL) { photo.src = user.photoURL; photo.style.display = "inline"; }
        
        // Avvia i prodotti se siamo online
        avviaListenerProdotti();
    } else {
        // Se manca internet controlliamo se c'era già un utente loggato in cache
        if (auth.currentUser) {
            loginScreen.style.display = "none";
            appScreen.style.display   = "block";
            avviaListenerProdotti();
        } else {
            loginScreen.style.display = "flex";
            appScreen.style.display   = "none";
        }
    }
});

function setStatus(msg, isError = false) {
    const el = document.getElementById("status");
    el.style.color = isError ? "#e63946" : "#f4a261";
    el.innerHTML = msg;
}

function escHtml(str) {
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function renderTabella(prodotti) {
    const tbody   = document.getElementById("tabella-prodotti");
    const counter = document.getElementById("counter");
    if (!tbody) return;
    if (prodotti.length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="4">Nessun prodotto 🎉</td></tr>`;
        if (counter) counter.innerHTML = "";
        return;
    }
    const acquistati = prodotti.filter(p => p.acquistato).length;
    if (counter) counter.innerHTML = `<span>${acquistati}</span> / ${prodotti.length} acquistati`;
    const gruppi = {};
    CATEGORIE_ORDER.forEach(c => gruppi[c] = []);
    prodotti.forEach(p => gruppi[p.categoria].push(p));
    let html = "";
    CATEGORIE_ORDER.forEach(cat => {
        const items = gruppi[cat];
        if (!items.length) return;
        html += `<tr class="cat-header"><td colspan="4">${CAT_EMOJI[cat]||"📦"} ${escHtml(cat)}</td></tr>`;
        items.forEach(p => {
            html += `<tr class="${p.acquistato?"acquistato":""}">
              <td><span class="nome-prodotto">${escHtml(p.nome)}</span></td>
              <td><span class="badge-qty">${p.quantita}</span></td>
              <td><span class="badge-loc">${escHtml(p.ubicazione)}</span></td>
              <td>
                <button class="btn-check" onclick="toggleAcquistato('${p.id}',${!!p.acquistato})">${p.acquistato?"↩️":"✓"}</button>
                <button class="btn-del" onclick="eliminaProdotto('${p.id}')">🗑</button>
              </td></tr>`;
        });
    });
    tbody.innerHTML = html;
}

// 3. FUNZIONI DI SCRITTURA OTTIMIZZATE (SENZA AWAIT PER FUNZIONARE OFFLINE)
function aggiungiProdotto() {
    const nome       = document.getElementById("nome").value.trim();
    const quantita   = parseInt(document.getElementById("quantita").value);
    const ubicazione = document.getElementById("ubicazione").value.trim();
    const categoria  = document.getElementById("categoria").value;

    if (!nome || !ubicazione || isNaN(quantita) || quantita < 1) {
        setStatus("⚠️ Compila tutti i campi.", true); return;
    }

    const btn = document.getElementById("btn-aggiungi");
    btn.disabled = true; btn.textContent = "Salvataggio…";

    prodottiRef.push({ 
        nome, 
        quantita, 
        ubicazione, 
        categoria, 
        acquistato: false, 
        timestamp: Date.now() 
    }).then(() => {
        setStatus("✅ Prodotto aggiunto!");
        setTimeout(() => setStatus(""), 2500);
    }).catch((err) => {
        setStatus("❌ Errore: " + err.message, true);
    });

    document.getElementById("nome").value = "";
    document.getElementById("quantita").value = "";
    document.getElementById("ubicazione").value = "";
    btn.disabled = false; 
    btn.textContent = "Aggiungi Prodotto";
}

function toggleAcquistato(id, stato) {
    db.ref("prodotti/" + id).update({ acquistato: !stato })
      .catch(err => setStatus("❌ Errore aggiornamento.", true));
}

function eliminaProdotto(id) {
    if (!confirm("Eliminare?")) return;
    db.ref("prodotti/" + id).remove()
      .then(() => {
          setStatus("🗑️ Eliminato.");
          setTimeout(() => setStatus(""), 2000);
      })
      .catch(err => setStatus("❌ Errore eliminazione.", true));
}

document.addEventListener("keydown", e => { if (e.key === "Enter") aggiungiProdotto(); });

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js")
        .catch(err => console.warn("SW:", err));
}

let deferredPrompt = null;
const banner = document.getElementById("install-banner");
window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); deferredPrompt = e; banner.style.display = "flex";
});
document.getElementById("btn-install").addEventListener("click", async () => {
    banner.style.display = "none";
    if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; }
});
document.getElementById("dismiss-install").addEventListener("click", () => { banner.style.display = "none"; });
