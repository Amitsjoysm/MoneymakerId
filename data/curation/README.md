# Curation spreadsheets (`data/curation/`)

These five files let you add information to MarketMind AI in bulk. You fill them in with a spreadsheet instead of entering items one at a time in the admin screens. Open a file in Google Sheets, Excel or LibreOffice, add rows under the example row, save it as CSV, then run the import (see [How to import](#how-to-import)).

| File | What it is for | One row is |
|---|---|---|
| [`places.csv`](#placescsv) | Restaurants, cafés and food stalls shown on food.marketmindai.com | one place |
| [`place_dishes.csv`](#place_dishescsv) | The dishes a place serves and their prices | one dish (or one portion size) at one place |
| [`providers.csv`](#providerscsv) | Contractors and companies shown on construction.marketmindai.com | one provider |
| [`experiences.csv`](#experiencescsv) | Your own visits: what you ate, what you paid and how good it was | one dish you tried on one visit |
| [`local_facts.csv`](#local_factscsv) | Sourced facts about a locality (water, soil, rainfall, society rules and so on) used on construction pages | one fact |

---

## The rules for every file

1. **Never change the first row.** The column names, their spelling and their order must stay exactly as they are. The importer reads columns by this header, so a changed header will make the import fail.
2. **Every fact needs a source.** The `source_url` column takes one of three kinds of value:

   | Write | When | Example |
   |---|---|---|
   | A web link starting with `https://` | You read the fact on that exact page: the place's own website or menu page, a government page, a news article | `https://example.com/menu` |
   | `visited` | You saw it yourself, in person. Put the visit date in `retrieved_at`. | `visited` |
   | `owner` | You are entering it yourself from first-hand business knowledge, for example details a contractor gave you directly | `owner` |

   - Paste the link of the page that actually shows the fact, not just the website's home page.
   - **Use apps and directories such as Zomato, Swiggy, Justdial, Google Maps, Sulekha or Magicpin only to find places.** Don't copy their prices, ratings, reviews, photos or menus into these files, and don't use their pages as `source_url`. Confirm the fact on the place's own website or menu, or by visiting.
   - If you can't say where a fact came from, leave it out.
3. **Dates** are written year-month-day: `2026-10-06`.
4. **Money** is whole rupees, digits only: `249`. Don't write `₹249`, `Rs 249`, `249.00` or `1,200` (write `1200`).
5. **Several values in one cell** are separated by `|`, the vertical bar (Shift + the backslash key). For example, `dine_in|takeaway|delivery`. Spaces around the `|` are not needed.
6. **IDs must be typed exactly**, in lowercase with hyphens: `wakad`, `pimple-saudagar`, `terrace-waterproofing`. The allowed IDs are listed under [Reference lists](#reference-lists).
7. **Yes/no columns** take `true` or `false`.
8. **If you don't know something, leave the cell empty. Never guess.** An empty cell is always better than a wrong one.
9. **Rows starting with `EXAMPLE` are skipped.** Each file comes with one made-up example row whose first cell starts with `EXAMPLE` (in capitals). The importer ignores any such row, so you can keep it as a reminder or delete it. Don't start a real row with the word `EXAMPLE`. The `example.com` links in the example rows are a reserved placeholder address, not a real source.
10. **Phone numbers and privacy.** Use the business's own published contact number. For a one-person contractor, enter their mobile number only if they have agreed to it. Never enter MarketMind AI's own WhatsApp number (the one ending in 46179) as a business's phone number.
11. **One place or provider is identified by its name plus its locality.** Spell the name the same way in every file, because `place_dishes.csv` and `experiences.csv` find the place by `place_name` + `locality_id`.

### Spreadsheet pitfalls

- **Phone numbers lose their `+`.** Excel and Google Sheets treat `+919…` as a number. Before typing, format the phone column as **Text** (in Google Sheets: Format → Number → Plain text). In Excel, you can also type an apostrophe first: `'+91…`.
- **Dates change format.** A spreadsheet may turn `2026-10-06` into `06/10/2026` when it saves. Format the date columns as **Text**, and check the saved file if you are unsure.
- **Saving.** In Excel, choose **File → Save As → "CSV UTF-8 (Comma delimited)"**, which keeps Marathi and Hindi letters intact. In Google Sheets, choose **File → Download → Comma-separated values (.csv)**.
- **Commas inside a cell** (an address, a note) are fine. The spreadsheet wraps that cell in double quotes when it saves. If you edit the file in a plain text editor, put double quotes around any cell that contains a comma, as the example rows do.

---

## `places.csv`

Use this file for restaurants, cafés, sweet shops and food stalls. Put each place in its own row. If a second source confirms the same place, you may add another row with the same `name` and `locality_id` and the new `source_url`.

| Column | Required? | What to write | Example |
|---|---|---|---|
| `name` | Required | The place's name as shown on its signboard or website | `EXAMPLE Biryani House` |
| `kind` | Required | Always `restaurant` in this file. Construction companies go in `providers.csv`. | `restaurant` |
| `locality_id` | Required | The locality ID (see [list](#localities)). In Hinjewadi, use the phase ID when you know it. | `wakad` |
| `address` | Optional | The full street address | `EXAMPLE Shop 0, Sample Road, Wakad, Pune` |
| `lat` | Optional | Latitude in decimal degrees, with a dot. Take it from your phone's map app while standing at the entrance, or from the place's own website. | `18.123456` (made-up number, to show the format) |
| `lng` | Optional | Longitude, in the same format as `lat` | `73.123456` (made-up number) |
| `phone` | Optional | `+91` followed by the 10-digit mobile or landline number, with no spaces. See [Spreadsheet pitfalls](#spreadsheet-pitfalls). | `+91` then the 10 digits |
| `website` | Optional | The place's own website or menu link, starting with `https://` | `https://example.com/` |
| `cuisines` | Optional | Cuisine names separated by `\|`. Spell them the same way every time. | `Hyderabadi\|Mughlai` |
| `diet` | Optional | `veg` = pure vegetarian; `egg` = vegetarian plus egg dishes, no meat or fish; `non_veg` = non-vegetarian food only, or almost only; `both` = serves vegetarian and non-vegetarian food | `both` |
| `price_level` | Optional | `1` = budget or street food, `2` = mid-range, `3` = premium, based on what a typical person spends | `2` |
| `service_modes` | Optional | Any of `dine_in`, `takeaway`, `delivery`, separated by `\|` | `dine_in\|takeaway\|delivery` |
| `opening_hours` | Optional | See [Writing opening hours](#writing-opening-hours) below | `mon=11:00-23:30;tue=11:00-23:30;…` |
| `tags` | Optional | Short labels separated by `\|`. The site's "family" and "office lunch" pages look for `family` and `office_lunch`. Write other tags in lowercase, with `_` instead of spaces. | `family\|office_lunch` |
| `source_url` | Required | An `https://` link, `visited` or `owner` (see [rule 2](#the-rules-for-every-file)). It is the source for every fact in this row. | `visited` |
| `retrieved_at` | Required | The date you checked the source or visited, as `YYYY-MM-DD` | `2026-10-06` |
| `valid_until` | Optional | Fill this only if the source states an end date, such as "hours valid till 31 Dec". Otherwise leave it empty, and each fact gets the standard freshness window: prices and hours 14 days, dishes and phone numbers 60 days, address 365 days. | (empty) |

### Writing opening hours

The cell lists when the place is open, in Pune time, on the 24-hour clock.

- Write each open day as `day=open-close`, and put `;` between days.
- Day names are `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`: lowercase, three letters.
- Write each time as two digits, a colon and two digits: `09:00` or `23:30`. Don't write `9am` or `9:00`.
- **Example (open every day, 11 am to 11:30 pm):**
  `mon=11:00-23:30;tue=11:00-23:30;wed=11:00-23:30;thu=11:00-23:30;fri=11:00-23:30;sat=11:00-23:30;sun=11:00-23:30`
- **Closed on a day:** leave that day out. For a place closed on Mondays, start with `tue=…`.
- **Two sessions in one day (lunch and dinner):** write that day twice: `mon=12:00-15:30;mon=19:00-23:00`.
- **Closes after midnight:** write the real closing time. A closing time earlier than the opening time means the next morning, so `fri=18:00-02:00` means Friday 6 pm until 2 am on Saturday.
- **Open 24 hours:** `mon=00:00-24:00`.
- **Fill this cell only if you know the hours for the whole week.** A day that is left out counts as closed. If you know only some days, leave the cell empty.
- The "Late night" badge depends on checked hours past 11 pm, so accurate hours matter.

---

## `place_dishes.csv`

This file records which dishes a place serves and what they cost. Use one row per dish, or one row per portion size if the menu lists more than one (half and full, say). Import `places.csv` first, because each row here is matched to a place by `place_name` + `locality_id`.

| Column | Required? | What to write | Example |
|---|---|---|---|
| `place_name` | Required | Exactly the same name as in `places.csv` | `EXAMPLE Biryani House` |
| `locality_id` | Required | The same locality ID as in `places.csv` | `wakad` |
| `dish_id` | Required | A dish ID (see [list](#dishes)) | `biryani` |
| `variant_label` | Optional | The menu's own wording for the item or portion | `Chicken biryani, full plate` |
| `price_inr` | Optional | The menu price in whole rupees. Leave it empty if you only know the dish is served. | `249` |
| `source_url` | Required | An `https://` link (ideally the menu page), `visited` or `owner` | `https://example.com/menu` |
| `retrieved_at` | Required | The date you saw the price, as `YYYY-MM-DD` | `2026-10-06` |
| `valid_until` | Optional | Fill this only if the menu or offer states an end date. Otherwise leave it empty; prices are treated as fresh for 14 days. | (empty) |

---

## `providers.csv`

Use this file for construction contractors and companies: waterproofing, painting, bathroom renovation, modular kitchens and house construction. Put each provider in its own row.

| Column | Required? | What to write | Example |
|---|---|---|---|
| `name` | Required | The business name | `EXAMPLE Waterproofing Works` |
| `locality_id` | Required | The locality ID of their office or base (see [list](#localities)) | `wagholi` |
| `address` | Optional | The office address | `EXAMPLE Office 0, Sample Road, Wagholi, Pune` |
| `phone` | Optional | `+91` followed by 10 digits, with no spaces. See [rule 10](#the-rules-for-every-file) on privacy. | `+91` then the 10 digits |
| `website` | Optional | Their website, starting with `https://` | `https://example.com/` |
| `services` | Required | Service IDs separated by `\|` (see [list](#services)). You can use a main service (`waterproofing`) or specific sub-services (`terrace-waterproofing`). | `terrace-waterproofing\|bathroom-waterproofing\|leakage-repair` |
| `service_localities` | Optional | The locality IDs they work in, separated by `\|`, including their own | `wagholi\|kharadi\|lohegaon` |
| `specializations` | Optional | Short phrases in plain words, separated by `\|` | `Terrace waterproofing\|Bathroom leak repair` |
| `experience_years` | Optional | Years in business, as a whole number | `8` |
| `accepts_leads` | Optional | `true` if they have agreed to receive customer enquiries from MarketMind AI; otherwise `false` | `true` |
| `min_job_inr` | Optional | The smallest job they take, in whole rupees | `15000` |
| `source_url` | Required | An `https://` link, `visited` or `owner` (for example, details they gave you directly) | `owner` |
| `retrieved_at` | Required | The date you checked, as `YYYY-MM-DD` | `2026-10-06` |

---

## `experiences.csv`

This file is your own food diary, the first-hand part of the site. Use one row for **each dish you tried on a visit**. If you tried three dishes at one meal, write three rows with the same `place_name`, `locality_id` and `visited_at`. This file has no `source_url` column, because every row is your own visit. Import `places.csv` first so that the place can be found. Photos are added later in the admin screens, not here.

| Column | Required? | What to write | Example |
|---|---|---|---|
| `place_name` | Required | Exactly the same name as in `places.csv` | `EXAMPLE Biryani House` |
| `locality_id` | Required | The same locality ID as in `places.csv` | `wakad` |
| `visited_at` | Required | The date of your visit, as `YYYY-MM-DD` | `2026-10-04` |
| `dish_id` | Required | The dish you tried (see [list](#dishes)) | `biryani` |
| `price_paid_inr` | Optional | What you actually paid for that dish, in whole rupees | `260` |
| `rating` | Required | Your rating of that dish: a whole number from `1` (poor) to `5` (excellent) | `4` |
| `would_recommend` | Optional | `true` or `false`: would you recommend the place? Use the same value on every row of one visit. | `true` |
| `tags` | Optional | Labels for the visit, separated by `\|`: `family`, `office_lunch`, `late_night` | `family\|late_night` |
| `notes` | Optional | A short note in your own words | `EXAMPLE note: generous portion, rice slightly oily` |

---

## `local_facts.csv`

This file holds facts about a locality that help people plan construction work there, such as water supply, soil, rainfall, building age and society rules. Use one row per fact. Write the fact in your own words, and make sure the linked page really supports it.

| Column | Required? | What to write | Example |
|---|---|---|---|
| `locality_id` | Required | The locality ID (see [list](#localities)) | `wakad` |
| `topic` | Required | One of: `housing_stock` (kinds of homes: flats, bungalows, townships) · `building_age` (how old the buildings are) · `water` (water supply, tankers, seepage) · `soil` · `rainfall` · `rules` (society or municipal rules) · `access` (roads, lift or material access) · `demand` (what people are building or repairing) · `other` | `water` |
| `services` | Required | The service IDs this fact matters for, separated by `\|` (see [list](#services)) | `terrace-waterproofing\|bathroom-waterproofing` |
| `text` | Required | The fact, in one or two sentences of your own words | `Write one fact in your own words that the linked page supports.` |
| `source_url` | Required | Preferably an `https://` link to the page that states the fact. `visited` or `owner` are allowed for something you have seen or know first-hand. | `https://example.com/report` |
| `source_title` | Required for links | The page or report title, exactly as shown on the page. Can be empty for `visited` or `owner`. | `EXAMPLE report title` |
| `publisher` | Required for links | The organisation or website that published it | `EXAMPLE Publisher` |
| `retrieved_at` | Required | The date you read the page, as `YYYY-MM-DD` | `2026-10-06` |

Imported facts count as drafts until you mark them reviewed. Pages that require reviewed text stay out of Google's index until then.

---

## How to import

The import command arrives in a later build step (task P05, Wave 5), and it needs the project installed on a computer that is connected to the database. Until then, you can still fill in the files; nothing is lost. When the command exists, import each file in two steps, from the project's main folder.

**Step 1: dry run (checks only, saves nothing)**

```
pnpm mm import:csv data/curation/places.csv --dry-run
```

The dry run checks every row and shows what would be added or changed. If any row has a problem, it lists the problems with line numbers. **If even one row is invalid, nothing from that file is imported.** Fix the file and run the dry run again until it is clean.

**Step 2: apply (saves for real)**

```
pnpm mm import:csv data/curation/places.csv --apply
```

**Order:** import `places.csv` before `place_dishes.csv` and `experiences.csv`, because those two refer to places. `providers.csv` and `local_facts.csv` can be imported at any time. Run the dry run first every time, even for a file you have imported before.

---

## Reference lists

These are the fixed IDs. The full, current lists live in `data/localities.json`, `data/dishes.json` and `data/services/`.

### Localities

`hinjewadi`, `wakad`, `baner`, `balewadi`, `aundh`, `kothrud`, `viman-nagar`, `kharadi`, `hadapsar`, `koregaon-park`, `shivajinagar`, `camp`, `kondhwa`, `wagholi`, `lohegaon`, `pimple-saudagar`, `pimple-nilakh`, `pimpri`, `chinchwad`, `magarpatta`

Hinjewadi sub-localities: `hinjewadi-phase-1`, `hinjewadi-phase-2`, `hinjewadi-phase-3`

### Dishes

`biryani`, `samosa`, `vada-pav`, `misal-pav`, `momos`, `dosa`, `pizza`, `burger`, `poha`, `pav-bhaji`, `shawarma`, `chole-bhature`, `thali`, `kebab`, `sandwich`, `desserts`

`data/dishes.json` may also contain more specific variant IDs (written `{variant}-{dish}`), which you can use as well.

### Services

| Main service | Sub-services |
|---|---|
| `waterproofing` | `terrace-waterproofing`, `bathroom-waterproofing`, `external-wall-waterproofing`, `basement-waterproofing`, `leakage-repair` |
| `painting` | `interior-painting`, `exterior-painting` |
| `bathroom-renovation` | (none) |
| `modular-kitchen` | (none) |
| `house-construction` | (none) |

---

## Technical notes (for the importer, task P05)

The rules that come from [`docs/CONTRACTS.md`](../../docs/CONTRACTS.md) §6 are fixed:

- the exact header rows
- `|` separates the values in a multi-value cell
- `opening_hours` is written `mon=HH:MM-HH:MM;…`
- `source_url` is `^https://`, `visited` or `owner`
- a row whose first field starts with `EXAMPLE` is skipped

Everything below is a convention this README introduces. The orchestrator should confirm it against P05.

- **File format:** UTF-8, with or without a byte-order mark; comma-separated; RFC 4180 quoting; LF or CRLF line endings.
- **Cell values:** an empty cell means `null`. Booleans are `true` or `false`. Integers are plain digits. Dates are `YYYY-MM-DD`.
- **Multi-value cells:** split on `|`, trim each value, drop empty values.
- **`opening_hours` grammar:** `entry (";" entry)*`, where `entry = day "=" HH:MM "-" HH:MM` and `day` is one of `mon`…`sun`.
  - A repeated day adds another interval.
  - An end time earlier than the start time crosses midnight.
  - `24:00` is allowed only as an end time.
  - A missing day means closed.
  - The result maps to `{"mon":[["11:00","23:30"]],…}` (IST).
- **`places.csv`:** `kind` must be `restaurant`. `price_level` is in 1–3. `diet` and `service_modes` use the CONTRACTS §3 enums.
- **`experiences.csv`:** rows sharing (`place_name`, `locality_id`, `visited_at`) form one visit. `rating` is per dish, from 1 to 5.
- **`local_facts.csv`:** `source_title` and `publisher` are required when `source_url` is an https link, and may be empty for `visited` or `owner`.
