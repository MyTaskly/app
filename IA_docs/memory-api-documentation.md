# Memory API — Gestione Memorie Utente (Mem0)

Le API di memoria permettono di visualizzare, aggiungere, modificare ed eliminare le informazioni persistenti salvate per ogni utente tramite il servizio Mem0. Queste memorie vengono usate dal chatbot per personalizzare le risposte in base alle preferenze e alla storia dell'utente.

---

## Autenticazione

Tutti gli endpoint richiedono due header obbligatori:

| Header | Valore |
|--------|--------|
| `X-API-Key` | Chiave API dell'applicazione |
| `Authorization` | `Bearer <access_token>` (JWT dell'utente) |

---

## Endpoint

### 1. Elenco memorie

**`GET /memory/`**

Restituisce tutte le memorie salvate per l'utente autenticato.

**Risposta — 200 OK**

```json
{
  "memories": [
    {
      "id": "mem_abc123",
      "memory": "L'utente preferisce ricevere notifiche la mattina alle 8.",
      "user_id": "42",
      "created_at": "2026-03-01T10:30:00Z",
      "updated_at": "2026-03-01T10:30:00Z"
    },
    {
      "id": "mem_def456",
      "memory": "L'utente lavora principalmente su progetti di sviluppo mobile.",
      "user_id": "42",
      "created_at": "2026-03-05T14:00:00Z",
      "updated_at": "2026-03-05T14:00:00Z"
    }
  ],
  "count": 2
}
```

**Risposta — 200 OK (nessuna memoria)**

```json
{
  "memories": [],
  "count": 0
}
```

---

### 2. Aggiungi una memoria

**`POST /memory/`**

Aggiunge una nuova memoria per l'utente autenticato. Mem0 elabora il testo e lo trasforma in un fatto strutturato.

**Body richiesta**

```json
{
  "content": "Preferisco che i task urgenti abbiano sempre una notifica anticipata di 30 minuti."
}
```

**Risposta — 201 Created**

```json
{
  "message": "Memoria aggiunta",
  "result": {
    "results": [
      {
        "id": "mem_xyz789",
        "memory": "L'utente preferisce ricevere notifiche anticipate di 30 minuti per i task urgenti.",
        "event": "ADD"
      }
    ]
  }
}
```

**Risposta — 503 Service Unavailable** (Mem0 non configurato o irraggiungibile)

```json
{
  "detail": "Mem0 non disponibile o chiave API non configurata."
}
```

---

### 3. Modifica una memoria

**`PUT /memory/{memory_id}`**

Sovrascrive il contenuto di una memoria esistente identificata dall'ID.

**Parametri URL**

| Parametro | Tipo | Descrizione |
|-----------|------|-------------|
| `memory_id` | string | ID della memoria da modificare (es. `mem_abc123`) |

**Body richiesta**

```json
{
  "content": "Preferisco ricevere notifiche anticipate di 15 minuti, non 30."
}
```

**Risposta — 200 OK**

```json
{
  "message": "Memoria aggiornata",
  "result": {
    "id": "mem_abc123",
    "memory": "L'utente preferisce ricevere notifiche anticipate di 15 minuti per i task urgenti.",
    "updated_at": "2026-03-10T09:00:00Z"
  }
}
```

**Risposta — 503 Service Unavailable**

```json
{
  "detail": "Impossibile aggiornare la memoria. Verifica che l'ID sia corretto e che Mem0 sia disponibile."
}
```

---

### 4. Elimina una memoria

**`DELETE /memory/{memory_id}`**

Elimina una singola memoria tramite il suo ID.

**Parametri URL**

| Parametro | Tipo | Descrizione |
|-----------|------|-------------|
| `memory_id` | string | ID della memoria da eliminare |

**Risposta — 200 OK**

```json
{
  "message": "Memoria eliminata"
}
```

**Risposta — 503 Service Unavailable**

```json
{
  "detail": "Impossibile eliminare la memoria. Verifica che l'ID sia corretto e che Mem0 sia disponibile."
}
```

---

### 5. Elimina tutte le memorie

**`DELETE /memory/`**

Elimina **tutte** le memorie dell'utente autenticato. Operazione irreversibile, pensata per la conformità GDPR.

**Risposta — 200 OK**

```json
{
  "message": "Tutte le memorie eliminate"
}
```

**Risposta — 503 Service Unavailable**

```json
{
  "detail": "Impossibile eliminare le memorie. Mem0 potrebbe non essere disponibile."
}
```

---

## Struttura di una memoria

Ogni oggetto memoria restituito da Mem0 ha la seguente struttura:

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | string | Identificatore univoco della memoria (usato per update/delete) |
| `memory` | string | Testo del fatto estratto e memorizzato |
| `user_id` | string | ID dell'utente proprietario |
| `created_at` | string (ISO 8601) | Data e ora di creazione |
| `updated_at` | string (ISO 8601) | Data e ora dell'ultima modifica |

---

## Note operative

- **Elaborazione automatica**: quando si aggiunge una memoria tramite `POST /memory/`, Mem0 non salva il testo verbatim ma lo elabora per estrarne fatti strutturati. Il risultato potrebbe essere riformulato.
- **Memorie automatiche dal chat**: ogni conversazione con il chatbot aggiunge automaticamente memorie in background. Gli endpoint di questa API permettono di gestirle manualmente.
- **Disponibilità condizionata**: se la variabile d'ambiente `MEM0_API_KEY` non è configurata, tutti gli endpoint rispondono con `503`. Il chatbot in questo caso funziona ugualmente, ma senza memoria persistente.
- **ID memoria**: l'ID di ogni memoria si ottiene dalla risposta di `GET /memory/` e va usato come parametro URL per `PUT` e `DELETE` singolo.
