# Mobile Handoff — Recurring Tasks Management

Questo documento descrive tutte le modifiche al server da implementare nell'app mobile.

---

## Contesto

I task ricorrenti ora sono un'entità separata dai task normali. Il server espone **un solo oggetto** per ogni task ricorrente (non istanze multiple): il campo `next_occurrence` indica quando scatterà la prossima volta. Il completamento di un'occorrenza si segnala con un endpoint dedicato.

---

## Nuovi Endpoint

### `POST /tasks/recurring/`
Crea un nuovo task ricorrente.

**Auth:** `X-API-Key` + JWT

**Request body:**
```json
{
  "title": "Daily standup",
  "description": "Riunione giornaliera",
  "start_time": "2026-04-14T09:00:00Z",
  "priority": "Media",
  "category_id": 3,

  // Scegliere UNO dei due:
  "interval_minutes": 90,          // ogni 90 minuti (ha precedenza su recurrence_pattern)
  "recurrence_pattern": "weekly",  // "daily" | "weekly" | "monthly"

  "interval": 1,                   // ogni N unità del pattern (default 1)
  "days_of_week": [1, 3, 5],       // solo per weekly: 1=Lun … 7=Dom

  "end_type": "never",             // "never" | "after_count" | "on_date"
  "end_count": null,               // obbligatorio se end_type="after_count"
  "end_date": null,                // obbligatorio se end_type="on_date"

  "extra_config": null             // JSON libero per future estensioni
}
```

**Validation:** almeno uno tra `interval_minutes` e `recurrence_pattern` è obbligatorio. Per `weekly`, `days_of_week` è obbligatorio.

**Response `201`:**
```json
{
  "id": 42,
  "user_id": 7,
  "category_id": 3,
  "title": "Daily standup",
  "description": null,
  "start_time": "2026-04-14T09:00:00Z",
  "priority": "Media",
  "interval_minutes": null,
  "recurrence_pattern": "weekly",
  "interval": 1,
  "days_of_week": [1, 3, 5],
  "end_type": "never",
  "end_date": null,
  "end_count": null,
  "occurrence_count": 0,
  "next_occurrence": "2026-04-14T09:00:00Z",
  "last_completed_at": null,
  "is_active": true,
  "google_calendar_event_id": null,
  "extra_config": null,
  "created_at": "2026-04-14T10:00:00Z",
  "updated_at": "2026-04-14T10:00:00Z"
}
```

---

### `GET /tasks/recurring/`
Lista tutti i task ricorrenti dell'utente.

**Query params:**
- `active_only=true` — mostra solo quelli attivi (default `false`)

**Response `200`:** array di oggetti `RecurringTaskOut` (stesso schema del POST).

---

### `GET /tasks/recurring/{id}`
Dettaglio singolo task ricorrente.

**Response `200`:** oggetto `RecurringTaskOut`.
**Response `404`:** task non trovato o non di proprietà dell'utente.

---

### `PATCH /tasks/recurring/{id}`
Aggiorna un task ricorrente. Tutti i campi sono opzionali. Se si modifica il pattern, `next_occurrence` viene ricalcolata automaticamente.

**Request body (tutti opzionali):**
```json
{
  "title": "Nuovo titolo",
  "recurrence_pattern": "daily",
  "interval": 2,
  "days_of_week": null,
  "end_type": "after_count",
  "end_count": 10,
  "is_active": true,
  "extra_config": { "reminder_minutes": 15 }
}
```

**Response `200`:** oggetto `RecurringTaskOut` aggiornato.

---

### `DELETE /tasks/recurring/{id}`
Elimina il task ricorrente.

**Response `204`:** nessun body.
**Response `404`:** task non trovato.

---

### `POST /tasks/recurring/{id}/complete`
Registra il completamento dell'occorrenza corrente. Il server:
1. Incrementa `occurrence_count`
2. Aggiorna `last_completed_at` a ora
3. Ricalcola `next_occurrence` (o disattiva il task se la fine è raggiunta)

**Request body:** vuoto

**Response `200`:** oggetto `RecurringTaskOut` aggiornato con la nuova `next_occurrence`.

---

## Endpoint Modificati

### `POST /calendar/sync` (era `/calendar/sync-to-tasks`)
La response ora include due contatori separati:

**Prima:**
```json
{ "created_count": 5, "skipped_count": 2, ... }
```

**Dopo:**
```json
{
  "tasks_synced": 3,
  "recurring_tasks_synced": 2,
  "skipped_count": 1,
  "deleted_count": 0,
  "errors": []
}
```

Gli eventi Google Calendar con RRULE vengono ora importati come `RecurringTask` invece di task normali. Il mobile può mostrare questi nella lista dei task ricorrenti.

---

## Endpoint Rimossi

| Vecchio endpoint | Sostituto |
|---|---|
| `POST /recurring-tasks/` | `POST /tasks/recurring/` |
| `GET /recurring-tasks/` | `GET /tasks/recurring/` |
| `GET /recurring-tasks/{id}` | `GET /tasks/recurring/{id}` |
| `GET /recurring-tasks/{id}/instances` | **rimosso** (non si creano più istanze) |
| `PUT /recurring-tasks/{id}` | `PATCH /tasks/recurring/{id}` |
| `DELETE /recurring-tasks/{id}` | `DELETE /tasks/recurring/{id}` |
| `POST /recurring-tasks/{id}/deactivate` | `PATCH /tasks/recurring/{id}` con `is_active: false` |

---

## Modello `RecurringTaskOut`

Tutti gli endpoint GET/POST/PATCH restituiscono questo schema:

| Campo | Tipo | Note |
|---|---|---|
| `id` | int | PK |
| `user_id` | int | |
| `category_id` | int \| null | |
| `title` | string | max 100 chars |
| `description` | string \| null | |
| `start_time` | datetime (UTC) | |
| `priority` | `"Bassa"` \| `"Media"` \| `"Alta"` | |
| `interval_minutes` | int \| null | precedenza su pattern |
| `recurrence_pattern` | `"daily"` \| `"weekly"` \| `"monthly"` \| null | |
| `interval` | int | default 1 |
| `days_of_week` | int[] \| null | [1..7], solo weekly |
| `end_type` | `"never"` \| `"after_count"` \| `"on_date"` | |
| `end_date` | datetime \| null | |
| `end_count` | int \| null | |
| `occurrence_count` | int | quante volte completato |
| `next_occurrence` | datetime \| null | quando scatterà la prossima volta |
| `last_completed_at` | datetime \| null | |
| `is_active` | bool | false = esaurito o disattivato |
| `google_calendar_event_id` | string \| null | se importato da GCal |
| `extra_config` | object \| null | JSON libero per estensioni future |
| `created_at` | datetime | |
| `updated_at` | datetime | |

---

## Comportamenti da Sapere

- **Un solo oggetto per task ricorrente**: non mostrare lista di scadenze future, ma un'unica card con `next_occurrence`.
- **`is_active: false`**: il task ha terminato le sue occorrenze (o è stato disattivato). Può essere nascosto o mostrato come "completato definitivamente".
- **`next_occurrence: null`** con `is_active: false`: il task è esaurito.
- **Completamento**: chiamare `POST /tasks/recurring/{id}/complete` invece di aggiornare lo status. La `next_occurrence` si aggiorna automaticamente.
- **Task da Google Calendar**: se `google_calendar_event_id` è presente, il task è stato importato da GCal e si rinnova secondo l'RRULE dell'evento originale.
