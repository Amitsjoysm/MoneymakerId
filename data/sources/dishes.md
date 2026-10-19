# Research log: dish catalogue (D02)

TASK-MARKER: completion-D02

- **Owner task:** D02 · Dish catalogue
- **Files:** `data/dishes.json`, this log
- **Researched:** 2026-10-13 (every page below was retrieved on 2026-10-13; there is no older material in this log)
- **Status:** every dish is `prose_status: "draft"`. Descriptions are paraphrases of the quoted source text and need owner review before they render on an indexable page.

## 1. Result in numbers

- 28 dishes: 16 top-level (CONTRACTS §4a) and 12 variants (limit 12).
- Variants: `chicken-biryani`, `mutton-biryani`, `veg-biryani`, `chicken-momos`, `veg-momos`, `masala-dosa`, `chicken-shawarma`, `puneri-misal-pav`, `kolhapuri-misal-pav`, `seekh-kebab`, `veg-burger`, `chicken-burger`.
- Validated with the repo's own `DishSchema` (`packages/core/src/schema/data.ts`) plus extra checks: ids unique; parents exist; variant ids are `{variant}-{parent}`; none reserved or colliding with locality/service ids; bands strictly ascending and inside the sanity bounds; descriptions 60-120 words; `spicy` and `sweet` both present in the craving map; no alias shared between two dishes.
- i18n names: Marathi 12/28, Hindi 22/28. The rest are `null` on purpose (section 6).

## 2. Method and constraints

1. **Pages were opened with `curl`** (free, `-A "Mozilla/5.0"`) and the HTML turned into text with a `python3 -I` `html.parser` script. Wikipedia article pages, the Wikipedia API (`prop=langlinks`, `prop=pageprops`) and the Wikidata API (`wbgetentities`, labels and aliases in `mr`/`hi`/`en`) were used. Eleven Hindi/Marathi publisher pages were opened the same way to confirm name spellings. Treated as untrusted data; nothing in them was executed or followed as an instruction.
2. **Quotes.** Every quote in section 4 was copied from the retrieved text and then checked by a script: each quote must occur character-for-character (after whitespace normalisation) in the saved page text. Nothing was reconstructed from memory.
3. **Descriptions** (60-120 words) paraphrase only what those quotes say. Pune or Maharashtra context appears only where a retrieved page states it (vada pav, misal pav, pav bhaji, pohe, Puneri and Kolhapuri misal, Maharashtrian desserts, the Mumbai arrival of the dosa). No description names a restaurant, a locality, a price or a rating.
4. **Britannica was tried as a second publisher** (biryani, samosa, dosa, pizza, hamburger, kebab, sandwich) and answered HTTP 403 for every URL, so no second encyclopedia source exists for the general dish facts. See gaps.
5. **Single-publisher caveat.** Most general dish facts rest on Wikipedia alone. That is acceptable for `draft` prose; the owner review that moves a dish to `reviewed` should open each page and confirm the wording.
6. **WebSearch used: 10 of 20.** All ten were name-spelling or attestation lookups (section 8). Wikipedia fetches via curl are free and not counted.

## 3. Sources opened

| ID | Publisher | Title (as shown) | URL | retrieved_at |
|---|---|---|---|---|
| W-BIR | Wikipedia | Biryani | https://en.wikipedia.org/wiki/Biryani | 2026-10-13 |
| W-SAM | Wikipedia | Samosa | https://en.wikipedia.org/wiki/Samosa | 2026-10-13 |
| W-VP | Wikipedia | Vada pav | https://en.wikipedia.org/wiki/Vada_pav | 2026-10-13 |
| W-MP | Wikipedia | Misal pav | https://en.wikipedia.org/wiki/Misal_pav | 2026-10-13 |
| W-MIS | Wikipedia | Misal | https://en.wikipedia.org/wiki/Misal | 2026-10-13 |
| W-PM | Wikipedia | Puneri misal | https://en.wikipedia.org/wiki/Puneri_misal | 2026-10-13 |
| W-MOMO | Wikipedia | Momo (food) | https://en.wikipedia.org/wiki/Momo_(food) | 2026-10-13 |
| W-DOSA | Wikipedia | Dosa (food) | https://en.wikipedia.org/wiki/Dosa_(food) | 2026-10-13 |
| W-MD | Wikipedia | Masala dosa | https://en.wikipedia.org/wiki/Masala_dosa | 2026-10-13 |
| W-PIZ | Wikipedia | Pizza | https://en.wikipedia.org/wiki/Pizza | 2026-10-13 |
| W-HAM | Wikipedia | Hamburger | https://en.wikipedia.org/wiki/Hamburger | 2026-10-13 |
| W-FLAT | Wikipedia | Flattened rice (fetched as the redirect "Poha (rice)") | https://en.wikipedia.org/wiki/Poha_(rice) | 2026-10-13 |
| W-PB | Wikipedia | Pav bhaji | https://en.wikipedia.org/wiki/Pav_bhaji | 2026-10-13 |
| W-SHA | Wikipedia | Shawarma | https://en.wikipedia.org/wiki/Shawarma | 2026-10-13 |
| W-CB | Wikipedia | Chole bhature | https://en.wikipedia.org/wiki/Chole_bhature | 2026-10-13 |
| W-THA | Wikipedia | Thali | https://en.wikipedia.org/wiki/Thali | 2026-10-13 |
| W-KEB | Wikipedia | Kebab | https://en.wikipedia.org/wiki/Kebab | 2026-10-13 |
| W-SEEK | Wikipedia | Seekh kebab | https://en.wikipedia.org/wiki/Seekh_kebab | 2026-10-13 |
| W-SAND | Wikipedia | Sandwich | https://en.wikipedia.org/wiki/Sandwich | 2026-10-13 |
| W-DES | Wikipedia | Dessert | https://en.wikipedia.org/wiki/Dessert | 2026-10-13 |
| W-GJ | Wikipedia | Gulab jamun | https://en.wikipedia.org/wiki/Gulab_jamun | 2026-10-13 |
| W-JAL | Wikipedia | Jalebi | https://en.wikipedia.org/wiki/Jalebi | 2026-10-13 |
| W-MAH | Wikipedia | Maharashtrian cuisine | https://en.wikipedia.org/wiki/Maharashtrian_cuisine | 2026-10-13 |
| W-MUT | Wikipedia | Lamb and mutton (fetched as the redirect "Mutton") | https://en.wikipedia.org/wiki/Mutton | 2026-10-13 |
| AMAR | Amarkosh Linguistics Pvt. Ltd. | थाळी / Amarkosh | https://amarkosh.tech/dictionary/marathi/थाळी/ | 2026-10-13 |
| HK-MISAL | Hebbar's Kitchen | मिसल पाव रेसिपी / misal pav recipe in hindi / महाराष्ट्रीयन मिसल पाव | https://hebbarskitchen.com/hi/spicy-maharashtrian-misal-pav-recipe/ | 2026-10-13 |
| HK-DOSA | Hebbar's Kitchen | मसाला डोसा रेसिपी / masala dosa in hindi / क्रिस्पी मसाले डोसे | https://hebbarskitchen.com/hi/masala-dosa-recipe-crispy-masale-dose/ | 2026-10-13 |
| HK-CHOLE | Hebbar's Kitchen | छोले भटूरे रेसिपी / chole bhature in hindi / छोला बटूरा / चना भटूरा | https://hebbarskitchen.com/hi/chole-bhature-recipe-chana-bhatura | 2026-10-13 |
| HK-MATKA | Hebbar's Kitchen | मटका बिरयानी रेसिपी / matka biryani in hindi / पॉट बिरियानी / मटका वेज बिरयानी | https://hebbarskitchen.com/hi/matka-biryani-recipe-pot-biriyani-recipe/ | 2026-10-13 |
| PK-POHA | Prabhat Khabar | Indori Poha Recipe: घर बैठे लें चटपटा इंदौरी पोहा का आनंद, नोट कर लें रेसिपी | https://www.prabhatkhabar.com/life-and-style/indori-poha-recipe-in-hindi | 2026-10-13 |
| PK-MOMOS | Prabhat Khabar | Momos Recipe: स्ट्रीट स्टाइल वेज मॉमोज बनाएं घर पर, आपकाे देगा क्रिस्पी और स्टीमी मजा | https://www.prabhatkhabar.com/life-and-style/momos-recipe-in-hindi | 2026-10-13 |
| KT-MUTTON | Kerala Tourism | मलबार मटन बिरयानी की रेसिपी, मांसाहारी चावल की किस्म, मलबार व्यंजन, केरल का भोजन / केरल पर्यटन | https://www.keralatourism.org/hindi/kerala-food/malabar-mutton-biriyani/39 | 2026-10-13 |
| PAT-CB | Patrika | Chicken Biryani Recipe : ईद पर खाने का स्वाद हो जाएगा दोगुना, कढ़ाही में ही ऐसे बनाएं चिकन बिरयानी / Chicken Biryani Recipe In Hindi To Make At Home | https://www.patrika.com/recipes/chicken-biryani-recipe-in-hindi-to-make-at-home-8328716/ | 2026-10-13 |
| WD | Wikidata | labels and aliases (`mr`, `hi`, `en`) for Q-items of the dishes, via `https://www.wikidata.org/w/api.php?action=wbgetentities` | https://www.wikidata.org/ | 2026-10-13 |
| WP-API | Wikipedia | interlanguage links `mr` and `hi` via `https://en.wikipedia.org/w/api.php?action=query&prop=langlinks` | https://en.wikipedia.org/ | 2026-10-13 |

Also opened but not cited for any claim: en.wikipedia.org `Bombay_sandwich`, `Dosa` (disambiguation), `Poha` (disambiguation), `Mithai` (disambiguation), `Kolhapuri_misal` (no such article), `Pohay` (same content as Flattened rice) and `hebbarskitchen.com/hi/hyderabadi-veg-mutton-biryani-recipe/`.

## 4. Dishes, description claims and verbatim quotes

Format per dish: editorial fields first (not claims about reality, see section 7), then the quotes the description rests on. `[ID]` refers to section 3.

### `biryani` · Biryani

- diet `both` · cravings `spicy`, `filling` · bands [200, 300, 500] · sanity 40-1500 INR
- description (86 words): Biryani is a mixed rice dish traditionally made with spiced meat, seafood or vegetables. It is thought to derive from a Persian rice dish and combines slow cooking with yoghurt-marinated meat and spicy Indian-style seasoning. Ingredients vary by region; chicken and goat are common meats, and vegetarian versions replace the meat with paneer, soya or vegetables. It may be served with raita, salad or a curried side such as mirchi ka salan. Biryani is the single most-ordered dish on Indian online food ordering and delivery services.
- quotes:
  - [W-BIR] "Biryani is a mixed rice dish traditionally made with spiced meat, seafood, or vegetables."
  - [W-BIR] "It is thought to derive from a Persian rice dish, either pilau or birinj biryan."
  - [W-BIR] "The dish makes use of slow-cooking as in Persian pilau, combined with Persian-style yoghurt-marinated meat and a spicy Indian style of cooking"
  - [W-BIR] "Meat (chicken, goat, beef) is the prime ingredient with rice."
  - [W-BIR] "Dietary variations include adding eggs, potatoes, and substituting meat with paneer, soyabean or vegetables, especially in Hindu or non-religious vegetarian variants."
  - [W-BIR] "Biryani may be served with side dishes such as raita (yoghurt with cucumber, tomato, etc), fried or curried aubergine (brinjal), salad, or a curried side such as ande ka salan (with boiled eggs) or mirchi ka salan (with chili peppers)."
  - [W-BIR] "Biryani is the single most-ordered dish in Indian online food ordering and delivery services"

### `samosa` · Samosa

- diet `both` · cravings `savoury`, `street` · bands [30, 50, 100] · sanity 5-300 INR
- description (81 words): A samosa is a fried turnover from the Indian subcontinent with a savoury filling that mostly consists of vegetables such as spiced potatoes, onions and peas, though paneer, meat or fish are also used. It is made as a triangle, cone or crescent depending on the region and is often accompanied by chutney. The name comes from the Middle Persian sambosag, meaning triangular pastry. In the east of the subcontinent it is called shingara. Samosas are popular snacks across South Asia.
- quotes:
  - [W-SAM] "is a fried Indian subcontinent turnover with a savoury filling that mostly consists of vegetables like spiced potatoes, onions, and peas, but can include cheese such as paneer, meat or even fish."
  - [W-SAM] "It is made in different shapes, including a triangle, a cone, or a crescent, depending on the region. Samosas are often accompanied by chutney"
  - [W-SAM] "Its name originates from the Middle Persian word sambosag"
  - [W-SAM] "(meaning 'triangular pastry')"
  - [W-SAM] "The names shingara, singara, or singada, used in the East of the Indian subcontinent including Bengal and Eastern Nepal"
  - [W-SAM] "Samosas are popular snacks in South Asia and within the Indian diaspora across the world."

### `vada-pav` · Vada Pav

- diet `veg` · cravings `spicy`, `street`, `savoury` · bands [20, 40, 80] · sanity 5-250 INR
- description (86 words): Vada pav is a vegetarian fast food dish native to Maharashtra: a deep-fried potato dumpling placed inside a bread bun (pav) sliced almost in half. It is generally accompanied by one or more chutneys, most commonly a spicy garlic-coconut chutney, and a green chilli. It began as an affordable street food in Mumbai and is now served at stalls and restaurants across India. It is also called the Bombay burger. In metropolitan areas including Mumbai and Pune, vada pav is among the most popular fast foods.
- quotes:
  - [W-VP] "is a vegetarian fast food dish native to the Indian state of Maharashtra. The dish consists of a deep-fried potato dumpling placed inside a bread bun (pav) sliced almost in half through the middle. It is generally accompanied by one or more chutneys and a green chili pepper."
  - [W-VP] "Although it originated as an affordable street food in Mumbai, it is now served in food stalls and restaurants across India. It is also called Bombay burger"
  - [W-VP] "most commonly a spicy lasun-khobara (garlic-coconut) chutney, along with fried green chilli."
  - [W-MAH] "In many metropolitan areas, including Mumbai and Pune, fast food is popular. The most-popular forms are bhaji, vada pav, misalpav and pav bhaji."

### `misal-pav` · Misal Pav

- diet `veg` · cravings `spicy`, `breakfast`, `filling` · bands [100, 150, 250] · sanity 20-600 INR
- description (81 words): Misal pav is a dish from Maharashtra made of a vegetable curry, mostly of moth beans (misal), served with pav, a type of bread roll. It is topped with farsan or sev, onions, lemon and coriander, and is usually served hot with butter-toasted bread or rolls, buttermilk or dahi, and papad. It is eaten as a breakfast dish, a snack and a full meal. Regional versions include Pune, Kolhapur, Nashik, Khandeshi and Ahmednagar misal, and most are on the spicier side.
- quotes:
  - [W-MP] "It consists of a vegetable curry, mostly made from moth beans, locally known as misal, and pav, which is a type of Indian bread roll. The final dish is topped with farsan or sev, onions, lemon and coriander (cilantro)."
  - [W-MP] "It is usually served hot with bread or rolls toasted with butter and buttermilk or dahi and papad. Misal pav is served as a breakfast dish, as a snack and also as a full meal."
  - [W-MP] "There are different versions of misal pav such as Pune misal, Khandeshi misal, Nashik misal and Ahmednagar misal."
  - [W-MP] "Misal pav from Kolhapur is known for its high spice content and unique taste."
  - [W-MP] "While most Misal variants are at a spicier side, Puneri Misal often has a sweet to tangy taste."

### `momos` · Momos

- diet `both` · cravings `savoury`, `street` · bands [100, 150, 250] · sanity 20-700 INR
- description (77 words): Momos are steamed, filled dumplings from Nepalese and Tibetan cuisine, also popular in India, Bhutan and Bangladesh. They are usually served with a dipping sauce known as achar or chutney, and can also be served in soup. Fillings include ground meat, vegetables, tofu, mushrooms and paneer. Momos are traditionally steamed but can also be deep-fried or pan-fried. In the Indo-Gangetic Plains the most common meat was chicken, and vegetable momos were introduced for the large vegetarian population.
- quotes:
  - [W-MOMO] "Momos are a type of steamed, filled dumpling in Nepalese and Tibetan cuisine, also popular in neighbouring Bangladesh, Bhutan, and India. They are usually served with a dipping sauce known as achar or chutney. They can also be served in soup"
  - [W-MOMO] "momos are prepared with virtually any combination of ground meat, vegetables, tofu, mushrooms, paneer cheese, soft chhurpi cheese, and vegetable and meat combinations."
  - [W-MOMO] "Momos are traditionally steamed but can also be deep-fried or pan-fried and cooked in soup."
  - [W-MOMO] "After arriving in the Indo-Gangetic Plains, the most common meat in momos was chicken, and vegetable momos were introduced to feed the large population of vegetarian Hindus."
  - [PK-MOMOS] "Momos Recipe: स्ट्रीट स्टाइल वेज मॉमोज बनाएं घर पर"

### `dosa` · Dosa

- diet `veg` · cravings `breakfast`, `savoury` · bands [100, 150, 250] · sanity 20-600 INR
- description (86 words): A dosa is a thin, savoury batter bread in South Indian cuisine, made from a fermented batter of ground black gram and rice. The batter is spread on a hot griddle (tava) to make a pancake that can be thick or thin and crispy. Dosas are served hot, often with chutney and sambar. Common varieties include masala dosa, plain (saada) dosa, paper dosa and rava dosa, which is made crispier with semolina. The dosa arrived in Mumbai with the opening of Udupi restaurants in the 1930s.
- quotes:
  - [W-DOSA] "is a thin, savoury batter bread in South Indian cuisine made from a fermented batter of ground black gram and rice. Dosas are served hot, often with chutney and sambar."
  - [W-DOSA] "The batter is then ladled onto a hot tava or griddle greased with oil or ghee. It is spread out with the base of a ladle or a bowl to form a pancake. It can be made either thick like a pancake, or thin and crispy."
  - [W-DOSA] "Masala dosa is a roasted dosa served with potato curry, chutney, and sambar, while saada (plain) dosa is prepared with a lighter texture; paper dosa is a thin and crisp version. Rava dosa is made crispier using semolina."
  - [W-DOSA] "The dosa arrived in Mumbai with the opening of Udupi restaurants in the 1930s."

### `pizza` · Pizza

- diet `both` · cravings `savoury`, `filling` · bands [200, 400, 600] · sanity 60-2500 INR
- description (85 words): Pizza is an Italian dish typically consisting of a flat base of leavened wheat-based dough topped with tomato, cheese and other ingredients, baked at a high temperature, traditionally in a wood-fired oven. The modern version is often credited to Naples at the end of the 19th century, and Neapolitan pizza is registered in the European Union as a traditional speciality guaranteed. Pizza is sold in pizzerias and other restaurants, by delivery and as street food, and in casual settings it is usually cut into slices.
- quotes:
  - [W-PIZ] "Pizza is an Italian dish typically consisting of a flat base of leavened wheat-based dough topped with tomato, cheese, and other ingredients, baked at a high temperature, traditionally in a wood-fired oven."
  - [W-PIZ] "Raffaele Esposito is often credited with creating the modern version of pizza in Naples at the end of the 19th century. In 2009, Neapolitan pizza was registered with the European Union as a traditional speciality guaranteed (TSG) dish."
  - [W-PIZ] "Pizza is sold at a variety of restaurants, including pizzerias, Mediterranean restaurants, via delivery, and as street food."
  - [W-PIZ] "In casual settings, however, it is typically cut into slices to be eaten while held in the hand."

### `burger` · Burger

- diet `both` · cravings `savoury`, `filling` · bands [100, 200, 300] · sanity 20-900 INR
- description (82 words): A burger, short for hamburger, is a filling placed inside a sliced bun or bread roll, usually a patty of panfried or grilled ground meat, often served with lettuce, tomato, onion, pickles and condiments. A burger with the patty topped with cheese is a cheeseburger. In India, where there are cultural beliefs against eating beef and pork, the term burger refers to a variety of sandwiches usually made from chicken or vegetable patties. The vada pav is sometimes called the Bombay burger.
- quotes:
  - [W-HAM] "A hamburger, often known as a burger, consists of fillings—usually a patty of panfried or grilled ground meat, typically beef—placed inside a sliced bun, sesame seed bun, or bread roll. These patties are often served with lettuce, tomato, onion, pickles, bacon, or chilis"
  - [W-HAM] "A burger with the patty topped with cheese is called a cheeseburger."
  - [W-HAM] "In India, where there are cultural beliefs against eating beef (which stem from Hindu religious practice) and pork (which stems from Islamic religious practice), the term burger refers to a variety of sandwiches usually made from chicken or vegetable patties."
  - [W-HAM] "The vada pav, consisting of a deep-fried potato patty dipped in gram flour batter, is sometimes called the Bombay burger."

### `poha` · Poha

- diet `veg` · cravings `breakfast`, `light` · bands [50, 80, 120] · sanity 10-350 INR
- description (78 words): Poha is flattened rice: rice grains pounded into flat flakes, a breakfast staple in South Asia. It is made by dehusking rice and parboiling or soaking it, then drying, roasting and flattening the grains. In Maharashtra, pohe is typically served with tea and is the dish a Maharashtrian is most likely to offer a guest. Kanda pohe is pohe prepared with onion, and batata pohe uses diced potatoes instead. Thinner flakes suit cooking and thicker ones suit deep-frying.
- quotes:
  - [W-FLAT] "Flattened rice is a preparation of rice made from raw, toasted, or parboiled rice grains pounded into flat flakes."
  - [W-FLAT] "Flattened rice is a breakfast staple in South Asia, where it is called chiura, poha, avalakki (Kannada), aval (Tamil, Malayalam), atukulu (Telugu), chuda (Odia), chira (Bengali), chiura/chura (Bhojpuri), sira (Assamese), phovu/fov (Konkani) and other names depending on the local language."
  - [W-FLAT] "Poha is made by dehusking rice grains and then parboiling or soaking them in hot water for 45 minutes. They are then dried, roasted, and flattened with rollers."
  - [W-FLAT] "Thinner varieties are ideal for cooking and dessert use, while thicker varieties are ideal for deep-frying."
  - [W-MAH] "Pohe is a snack made from pounded rice. It is typically served with tea and is the most likely dish that a Maharashtrian will offer a guest."
  - [W-MAH] "kanda pohe (literal translation, "pohe prepared with onion")"
  - [W-MAH] "Other variants include batata pohe (where diced potatoes are used instead of onion shreds)."
  - [PK-POHA] "जब कुछ हल्का खाने का मन करे तो आप इंदौरी पोहा को बनाकर ट्राई कर सकते हैं. इसे आप ब्रेकफास्ट या शाम की स्नैक्स में खा सकते हैं."

### `pav-bhaji` · Pav Bhaji

- diet `veg` · cravings `spicy`, `street`, `filling` · bands [100, 150, 250] · sanity 30-700 INR
- description (89 words): Pav bhaji is a staple food of Maharashtra: a thick, spicy vegetable curry (bhaji) served with a soft, buttered bread roll (pav). The bhaji is a spiced mixture of mashed vegetables such as potatoes, onions, chilli peppers, green peas, bell peppers and tomatoes, cooked on a flat griddle (tawa) with plenty of butter and garnished with coriander. It is served as a street snack or a main dish. It began as a fast lunchtime dish for textile mill workers in Mumbai. Variations include cheese, paneer and Jain pav bhaji.
- quotes:
  - [W-PB] "is a staple food of Maharashtra, consisting of a thick spicy vegetable curry (bhaji) served with a soft, buttered bread roll (pav). It is typically served either as a street snack or main dish"
  - [W-PB] "Pav bhaji is a spiced mixture of mashed vegetables in a thick gravy( Called "Bhaji" ) served with bread. Vegetables in the thick curry commonly include potatoes, onions, chili peppers, green peas, bell peppers, and tomatoes. It is usually cooked the curry on a flat griddle ( called Tawa) with a lot of butter and served hot."
  - [W-PB] "Finished Pav Bhaji ( Gravy and Bread ) is garnished with coriander"
  - [W-PB] "The dish originated as a fast lunchtime dish for textile mill workers in Mumbai."
  - [W-PB] "Cheese pav bhaji, with cheese on top of the bhaji"
  - [W-PB] "Paneer pav bhaji, with paneer in the bhaji"
  - [W-PB] "Jain pav bhaji, without onions and garlic and with plantains instead of potatoes"

### `shawarma` · Shawarma

- diet `non_veg` · cravings `spicy`, `street` · bands [100, 150, 250] · sanity 30-800 INR
- description (89 words): Shawarma is a popular street food of the Middle East that originated in the Levant during the Ottoman Empire. Meat is cut into thin slices, stacked in an inverted cone and roasted on a slow-turning vertical spit, and shavings are cut off as it cooks. It is traditionally made with lamb or mutton but may also use chicken, turkey, beef or veal. It is commonly served as a sandwich or wrap in a flatbread such as pita or lavash, and the spices may include cumin, cardamom, cinnamon and turmeric.
- quotes:
  - [W-SHA] "is a popular street food in the Middle East that originated in the Levant during the Ottoman Empire. It consists of meat cut into thin slices, stacked in an inverted cone, and roasted on a slow-turning vertical spit. Traditionally made with lamb or mutton, it may also be made with chicken, turkey meat, beef, falafel or veal. The surface of the rotisserie meat is routinely shaved off once it cooks and is ready to be served."
  - [W-SHA] "Shawarma is commonly served as a sandwich or wrap, in a flatbread such as pita, shrak (saj), laffa or lavash."
  - [W-SHA] "Spices may include cumin, cardamom, cinnamon, turmeric or paprika"

### `chole-bhature` · Chole Bhature

- diet `veg` · cravings `breakfast`, `street`, `filling` · bands [100, 150, 250] · sanity 30-600 INR
- description (88 words): Chole bhature pairs chickpea curry (chole) with bhatura, a deep-fried flatbread made from maida, or refined wheat flour. The bhatura dough is fermented before being rolled and fried, so it puffs up and turns crispy and golden brown. The dish is served hot, commonly as a breakfast or street food, sometimes with lassi, and may be accompanied by onions, chutney, achaar or lemon slices. Its origin is debated, with some sources attributing it to Punjab, and by the 2010s it had become a popular fast food across India.
- quotes:
  - [W-CB] "is a dish pairing chickpea curry with bhatura, a deep-fried flatbread. It is commonly eaten as a breakfast or street food."
  - [W-CB] "Chole bhature is a combination of chole (chana masala, or chickpea curry) and bhatura, a deep-fried bread made from maida (refined wheat flour)."
  - [W-CB] "Bhature is made of dough that is fermented before being rolled and fried, which causes it to quickly puff up before turning crispy and golden brown. The dish is served hot."
  - [W-CB] "Chole bhature is primarily a breakfast dish, sometimes accompanied with lassi."
  - [W-CB] "may be accompanied by onions, chutney, achaar, or lemon slices."
  - [W-CB] "the origin of chole bhature is debated, with some sources attributing its origin to Punjab. It spread to Delhi after the partition of India, where it is a popular dish. By the 2010s, it had become a popular fast food across India."

### `thali` · Thali

- diet `both` · cravings `filling` · bands [150, 250, 400] · sanity 50-1500 INR
- description (89 words): Thali is a round platter used to serve food in South Asia, and the word also refers to an Indian-style meal made up of a selection of dishes served on a platter. The idea behind a thali is to offer different flavours of sweet, salt, bitter, sour, astringent and spicy on one single plate. Restaurants typically offer a choice of vegetarian or meat-based thalis. In Marathi, thali (थाळी) is a shallow, wide metal plate used for eating, and in a restaurant the word can also mean a set meal.
- quotes:
  - [W-THA] "is a round platter used to serve food in South Asia, Southeast Asia and the Caribbean. Thali is also used to refer to an Indian-style meal made up of a selection of various dishes which are served on a platter."
  - [W-THA] "The idea behind a thali is to offer different flavours of sweet, salt, bitter, sour, astringent and spicy on one single plate"
  - [W-THA] "Restaurants typically offer a choice of vegetarian or meat-based thalis."
  - [AMAR] "जेवणाच्या उपयोगाचे उथळ व पसरट धातूचे पात्र."
  - [AMAR] "उपहारगृहात विशिष्ट प्रकारचे, विशिष्ट प्रमाणात वाढलेले खाद्यपदार्थ."

### `kebab` · Kebab

- diet `both` · cravings `spicy`, `savoury` · bands [200, 300, 500] · sanity 50-2000 INR
- description (91 words): Kebab is a variety of roasted meat dishes that originated in the Middle East. Kebabs consist of cut-up meat, sometimes with vegetables and other accompaniments, and are typically cooked on a skewer over a fire, though some are oven-baked in a pan or prepared as a stew. The traditional meat is most often lamb, but regional recipes may use beef, goat, chicken, fish or pork. The word reached English partly through Hindi-Urdu and Persian. Seekh kebab is a type from the Indian subcontinent, made from spiced minced meat grilled on skewers.
- quotes:
  - [W-KEB] "is a variety of roasted meat dishes that originated in the Middle East."
  - [W-KEB] "Kebabs consist of cut-up meat, sometimes with vegetables and various other accompaniments according to the specific recipe. Although kebabs are typically cooked on a skewer over a fire, some kebab dishes are oven-baked in a pan, or prepared as a stew such as tas kebab. The traditional meat for kebabs is most often lamb meat, but regional recipes may include beef, goat, chicken, fish, or even pork"
  - [W-KEB] "partly via kabāb (कबाब / کباب) Hindi-Urdu and Persian"
  - [W-SEEK] "Seekh kebab is a type of kebab from the Indian subcontinent. It is made with  Indian spices, spiced minced or ground meat, usually lamb, beef, or chicken, formed into cylinders on skewers and grilled."

### `sandwich` · Sandwich

- diet `both` · cravings `savoury`, `light` · bands [80, 150, 250] · sanity 15-700 INR
- description (96 words): A sandwich is a dish typically made of meat, cheese, sauces and vegetables used as a filling between slices of bread, or placed on top of a slice of bread as an open sandwich. More generally it is any dish in which bread serves as a container or wrapper for another food. Sandwiches are a popular lunch food, taken to work, school or picnics, and can be served hot or cold. Most are savoury, but sweet sandwiches such as jam sandwiches form their own category. The dish is named after John Montagu, 4th Earl of Sandwich.
- quotes:
  - [W-SAND] "A sandwich is a dish typically consisting variously of meat, cheese, sauces, and vegetables used as a filling between slices of bread, or placed atop a slice of bread (known as an open sandwich); or, more generally, any dish in which bread serves as a container or wrapper for another food type."
  - [W-SAND] "Sandwiches are a popular type of lunch food, taken to work, school, or picnics to be eaten as part of a packed lunch."
  - [W-SAND] "As well as being homemade, sandwiches are also widely sold in various retail outlets and can be served hot or cold. Although savoury sandwiches—such as deli meat sandwiches—are in the majority, sweet sandwiches—such as jam sandwiches and fluffernutters—form their own category."
  - [W-SAND] "John Montagu, 4th Earl of Sandwich"

### `desserts` · Desserts

- diet `both` · cravings `sweet` · bands [100, 200, 400] · sanity 10-3000 INR
- description (81 words): Desserts are sweet foods eaten at the end of a meal, such as cake, biscuits and ice cream. Indian sweets include gulab jamun, made mainly from milk solids and soaked in a flavoured sugar syrup, and jalebi, a deep-fried batter soaked in sugar syrup. In Maharashtrian cuisine, typical desserts include puran poli, a flatbread stuffed with jaggery and lentils, shrikhand, strained yogurt flavoured with sugar and saffron, basundi and modak, and desserts are an important part of festivals and special occasions.
- quotes:
  - [W-DES] "A dessert is a dish that consists of sweet foods, such as cake, biscuit, ice cream, and possibly a beverage, such as dessert wine or liqueur."
  - [W-GJ] "Gulab jamuns are made mainly from milk solids (traditionally known as khoa or khoya)"
  - [W-GJ] "soaked in a light sugar syrup that has been flavored with green cardamom and rose water, kewra or saffron."
  - [W-JAL] "The south Asian variety is made by deep-frying maida flour (plain flour or all-purpose flour) batter in pretzel or circular shapes, which are then soaked in sugar syrup."
  - [W-MAH] "Desserts are important part of festival and special occasions. Typical desserts include, flatbread called puran poli with stuffed lentil and jaggery mix, a preparation made from strained yogurt, sugar and spices called shrikhand, a sweet milk preparation made with evaporated milk called basundi, semolina and sugar based kheer and steamed dumplings stuffed with coconut and jaggery called modak."
  - [W-MAH] "Shrikhand is strained yogurt flavoured with sugar, saffron, cardamom and charoli nuts."

### `chicken-biryani` · Chicken Biryani (variant of `biryani`)

- diet `non_veg` · cravings `spicy`, `filling` · bands [200, 300, 500] · sanity 50-1500 INR
- description (89 words): Chicken biryani is the chicken version of biryani, a mixed rice dish traditionally made with spiced meat. Chicken is named among the prime meats used with rice in biryani, alongside goat and beef. The dish combines slow cooking as in Persian pilau with yoghurt-marinated meat and a spicy Indian style of cooking. It may be served with raita, salad or a curried side such as ande ka salan, made with boiled eggs. Biryani as a whole is the single most-ordered dish on Indian online food ordering and delivery services.
- quotes:
  - [W-BIR] "Meat (chicken, goat, beef) is the prime ingredient with rice."
  - [W-BIR] "The dish makes use of slow-cooking as in Persian pilau, combined with Persian-style yoghurt-marinated meat and a spicy Indian style of cooking"
  - [W-BIR] "a curried side such as ande ka salan (with boiled eggs)"
  - [W-BIR] "Biryani is the single most-ordered dish in Indian online food ordering and delivery services"
  - [PAT-CB] "ऐसे बनाएं चिकन बिरयानी"

### `mutton-biryani` · Mutton Biryani (variant of `biryani`)

- diet `non_veg` · cravings `spicy`, `filling` · bands [250, 400, 600] · sanity 80-2000 INR
- description (83 words): Mutton biryani is biryani made with mutton, the slow-cooked, spiced meat-and-rice dish thought to derive from a Persian rice dish. In most countries of South Asia the term mutton is applied to goat meat, so mutton biryani is usually a goat-meat biryani. The Muslim festival of Bakr Eid is marked by biryani at dinner, using the mutton from goats slaughtered for the occasion. Biryani may be served with raita, salad or a curried side such as mirchi ka salan, made with chilli peppers.
- quotes:
  - [W-MUT] "The term "mutton" is applied to goat meat in most countries of South Asia"
  - [W-BIR] "The Muslim festival of Bakr Eid is marked by biryani at dinner, using the mutton from goats slaughtered in memory of the prophet Abraham"
  - [W-BIR] "It is thought to derive from a Persian rice dish, either pilau or birinj biryan."
  - [W-BIR] "mirchi ka salan (with chili peppers)"
  - [KT-MUTTON] "मलबार मटन बिरयानी की रेसिपी, मांसाहारी चावल की किस्म"

### `veg-biryani` · Veg Biryani (variant of `biryani`)

- diet `veg` · cravings `spicy`, `filling` · bands [150, 250, 400] · sanity 40-1200 INR
- description (74 words): Veg biryani is the vegetarian version of biryani, a mixed rice dish traditionally made with spiced meat, seafood or vegetables. Dietary variations substitute the meat with paneer, soyabean or vegetables, especially in Hindu or non-religious vegetarian variants. Like other biryanis it is slow-cooked with spices and may be served with raita, salad or fried or curried aubergine. Biryani as a whole is the single most-ordered dish on Indian online food ordering and delivery services.
- quotes:
  - [W-BIR] "Dietary variations include adding eggs, potatoes, and substituting meat with paneer, soyabean or vegetables, especially in Hindu or non-religious vegetarian variants."
  - [W-BIR] "Biryani is a mixed rice dish traditionally made with spiced meat, seafood, or vegetables."
  - [W-BIR] "fried or curried aubergine (brinjal)"
  - [HK-MATKA] "मटका वेज बिरयानी"

### `chicken-momos` · Chicken Momos (variant of `momos`)

- diet `non_veg` · cravings `savoury`, `street` · bands [100, 150, 250] · sanity 20-700 INR
- description (79 words): Chicken momos are momos filled with chicken. Momos are steamed, filled dumplings from Nepalese and Tibetan cuisine, and after they reached the Indo-Gangetic Plains the most common meat in them was chicken. Minced meat fillings may be combined with onions or shallots, garlic, ginger and coriander, and some cooks add puréed tomatoes and soy sauce. They are traditionally steamed but can also be deep-fried or pan-fried, and are usually served with a dipping sauce such as achar or chutney.
- quotes:
  - [W-MOMO] "After arriving in the Indo-Gangetic Plains, the most common meat in momos was chicken"
  - [W-MOMO] "Minced meat is combined with any or all of the following: onions/shallots, garlic, ginger, and cilantro/coriander. Some people also add finely puréed tomatoes and soy sauce."
  - [W-MOMO] "Momos are traditionally steamed but can also be deep-fried or pan-fried and cooked in soup."
  - [W-MOMO] "They are usually served with a dipping sauce known as achar or chutney."

### `veg-momos` · Veg Momos (variant of `momos`)

- diet `veg` · cravings `savoury`, `street` · bands [80, 120, 200] · sanity 20-600 INR
- description (80 words): Veg momos are momos with a vegetarian filling. Momos are steamed, filled dumplings from Nepalese and Tibetan cuisine, and vegetable momos were introduced in India to feed the large population of vegetarian Hindus. In Nepal, vegetable fillings include finely chopped cabbage, carrot, soy granules and potato, and momos are also made with tofu, mushrooms or paneer. They are traditionally steamed but can also be deep-fried or pan-fried, and are usually served with a dipping sauce such as achar or chutney.
- quotes:
  - [W-MOMO] "vegetable momos were introduced to feed the large population of vegetarian Hindus."
  - [W-MOMO] "Finely chopped cabbage, carrot, soy granules, potato, flat bean, or chayote are used as fillings in Nepal."
  - [W-MOMO] "momos are prepared with virtually any combination of ground meat, vegetables, tofu, mushrooms, paneer cheese, soft chhurpi cheese, and vegetable and meat combinations."
  - [PK-MOMOS] "घर पर बनाएं होटल जैसे टेस्टी और हेल्दी वेज मोमोज"

### `masala-dosa` · Masala Dosa (variant of `dosa`)

- diet `veg` · cravings `breakfast`, `savoury` · bands [100, 150, 250] · sanity 20-600 INR
- description (88 words): Masala dosa is a dish of South India consisting of a savoury dosa crepe stuffed with a spiced potato stir fry. It is a popular breakfast item in South India, though it can be served at all times of the day. The rice and legumes, such as black gram, are fermented by soaking overnight and ground into a batter, which is spread on a hot tava griddle, pan-roasted until crispy, filled with potato curry and served with chutneys and sambar. Paper masala dosa is a thinner, crisper version.
- quotes:
  - [W-MD] "is a dish of South India, consisting of a savoury dosa crepe stuffed with a spiced potato stir fry. It is a popular breakfast item in South India, though it can be served at all times of the day"
  - [W-MD] "The rice and legumes are fermented by soaking them overnight in water, then ground into a batter. To make the dosa, the batter is spread on a hot tava griddle using a ladle or a bowl. It is pan-roasted until crispy, filled with potato curry, and served with chutneys, and sambar."
  - [W-MD] "One common variant is the paper masala dosa, which is made with a thinner batter, resulting in a crisper, almost paper-thin final product."
  - [HK-DOSA] "यह चावल और उड़द की दाल से बना एक स्वादिष्ट दक्षिण भारतीय स्टेपल ब्रेकफास्ट रेसिपी है।"

### `chicken-shawarma` · Chicken Shawarma (variant of `shawarma`)

- diet `non_veg` · cravings `spicy`, `street` · bands [100, 150, 250] · sanity 30-800 INR
- description (87 words): Chicken shawarma is shawarma made with chicken: thin cuts of seasoned, marinated meat stacked on a skewer and slowly roasted on a vertical spit as it turns, with shavings cut off to serve. In the Middle East it is typically served with garlic sauce, fries and pickles, and toum, a garlic sauce, is usually served with chicken shawarma. Syrian-style shawarma commonly uses chicken breast and thigh meat rather than lamb or beef. It is commonly served as a sandwich or wrap in a flatbread such as pita.
- quotes:
  - [W-SHA] "Shawarma is prepared from thin cuts of seasoned and marinated lamb, mutton, veal, beef, chicken, or turkey. The slices are stacked on a skewer about 60 cm (20 in) high."
  - [W-SHA] "In the Middle East, chicken shawarma is typically served with garlic sauce, fries, and pickles. The garlic sauce served with the sandwich depends on the meat. Toum or toumie sauce is made from garlic, vegetable oil, lemon, and egg white or starch, and is usually served with chicken shawarma."
  - [W-SHA] "Syrian shawarma commonly uses chicken breast and thigh meat rather than lamb or beef"
  - [W-SHA] "Shawarma is commonly served as a sandwich or wrap, in a flatbread such as pita, shrak (saj), laffa or lavash."

### `puneri-misal-pav` · Puneri Misal Pav (variant of `misal-pav`)

- diet `veg` · cravings `breakfast`, `filling` · bands [100, 150, 250] · sanity 20-600 INR
- description (82 words): Puneri misal is a vegetarian version of misal from Pune, Maharashtra, eaten for breakfast, as a midday snack or as a meal, often as part of misal pav. It is described as less hot and spicy than Kolhapuri misal and often has a sweet to tangy taste, and this version contains pohe. The ingredients typically include matki usal, a moth bean curry, a spicy gravy called tarri or kat, potato bhaji, yogurt, chivda, farsan, and a garnish of onions, tomatoes and coriander.
- quotes:
  - [W-PM] "Puneri misal is a popular vegetarian dish from Pune, Maharashtra, India. The dish is eaten for breakfast or as a midday snack or meal, often as part of misal pav."
  - [W-PM] "This dish is not so hot and spicy like Kolhapuri Misal."
  - [W-MP] "Puneri Misal often has a sweet to tangy taste."
  - [W-MP] "Puneri misal is another version that contains pohe."
  - [W-PM] "The ingredients of misal include matki usal, tarry/kat/sample, potato bhaji, yogurt, chivda, farsan, garnish of onions, tomatoes, and coriander."

### `kolhapuri-misal-pav` · Kolhapuri Misal Pav (variant of `misal-pav`)

- diet `veg` · cravings `spicy`, `breakfast`, `filling` · bands [100, 150, 250] · sanity 20-600 INR
- description (95 words): Kolhapuri misal is the version of misal from Kolhapur, Maharashtra, known for its high spice content, which is achieved through the use of kala masala. According to one account it usually does not contain pohe and is served with thick slices of bread rather than pav, but it is also sold as misal pav. Misal itself is a Maharashtrian dish of spiced moth bean curry (usal) with a spicy gravy called tarri, kat or rassa, topped with farsan or sev, onions, tomatoes and coriander, and eaten for breakfast, as a snack or as a meal.
- quotes:
  - [W-MIS] "Kolhapuri Misal is known for its spiciness, which is achieved through the use of kala masala."
  - [W-MIS] "The Kolhapuri version of misal is usually spicy and does not contain pohe and is served with thick slices of bread, not pav."
  - [W-MP] "Misal pav from Kolhapur is known for its high spice content and unique taste."
  - [W-MIS] "Tarri/kat/sample/rassa, a spicy gravy."
  - [W-MIS] "The dish is mostly eaten for breakfast or as a midday snack or sometimes as a one-dish meal, often as part of misal pav."
  - [W-MIS] "Usal, a curry made from matki (moth bean) or watane (dried pea) or even mung beans."
  - [W-MIS] "Farsan/Shev (not required if Chivda is used), most of the misal in maharashtra use Farsan/Shev in it."
  - [W-MIS] "Garnish of onions, tomatoes, coriander, lemon wedge"

### `seekh-kebab` · Seekh Kebab (variant of `kebab`)

- diet `both` · cravings `spicy`, `savoury` · bands [200, 300, 500] · sanity 50-2000 INR
- description (83 words): Seekh kebab is a type of kebab from the Indian subcontinent, made with Indian spices and spiced minced or ground meat, usually lamb, beef or chicken, formed into cylinders on skewers and grilled. It is typically cooked on a mangal or barbecue, or in a tandoor, and seasoned with ginger, garlic, green chilli, powdered chilli, garam masala, lemon juice, coriander and mint. It is typically served with raita, salad, onion slices, lemon wedges or green chutney. Vegetarian seekh kebabs are common in India.
- quotes:
  - [W-SEEK] "Seekh kebab is a type of kebab from the Indian subcontinent. It is made with  Indian spices, spiced minced or ground meat, usually lamb, beef, or chicken, formed into cylinders on skewers and grilled. It is typically cooked on a mangal or barbecue, or in a tandoor."
  - [W-SEEK] "seasoned with various spices such as ginger, garlic, green chilli pepper, powdered chilli and garam masala, as well as lemon juice, coriander (cilantro) and mint leaves."
  - [W-SEEK] "Seekh kebabs are typically served with raita, salad, onion slices, lemon wedges or green chutney"
  - [W-SEEK] "Vegetarian seekh kebabs common in India are made with beans, carrots, potatoes, cauliflower and green peas."

### `veg-burger` · Veg Burger (variant of `burger`)

- diet `veg` · cravings `savoury`, `filling` · bands [80, 150, 250] · sanity 20-700 INR
- description (70 words): A veg burger is a burger with a vegetarian patty in place of meat. Vegetarian and vegan burger patties can be formed from tofu, textured vegetable protein, seitan, beans, grains or an assortment of vegetables, and are served in a sliced bun. In India, where there are cultural beliefs against eating beef and pork, the term burger refers to a variety of sandwiches usually made from chicken or vegetable patties.
- quotes:
  - [W-HAM] "Vegetarian and vegan burgers can be formed from a meat analogue. These may include, when formed into patties, tofu, TVP, seitan (wheat gluten), beans, grains, or an assortment of vegetables."
  - [W-HAM] "In India, where there are cultural beliefs against eating beef (which stem from Hindu religious practice) and pork (which stems from Islamic religious practice), the term burger refers to a variety of sandwiches usually made from chicken or vegetable patties."
  - [W-HAM] "placed inside a sliced bun, sesame seed bun, or bread roll."

### `chicken-burger` · Chicken Burger (variant of `burger`)

- diet `non_veg` · cravings `savoury`, `filling` · bands [100, 200, 300] · sanity 20-900 INR
- description (70 words): A chicken burger is a burger with chicken in place of beef. The filling may be ground chicken meat, chicken breast (marinated or not) or fried chicken, placed inside a sliced bun and often served with lettuce, tomato, onion, pickles and condiments. In India, where there are cultural beliefs against eating beef and pork, the term burger refers to a variety of sandwiches usually made from chicken or vegetable patties.
- quotes:
  - [W-HAM] "Chicken burger:"
  - [W-HAM] "Ground chicken meat"
  - [W-HAM] "Chicken breast (marinated or not)"
  - [W-HAM] "Fried chicken"
  - [W-HAM] "These patties are often served with lettuce, tomato, onion, pickles, bacon, or chilis"
  - [W-HAM] "the term burger refers to a variety of sandwiches usually made from chicken or vegetable patties."

## 5. Aliases

An alias is a search-matching spelling, not a factual claim. They are split by whether the spelling occurs on any page retrieved for this task.

**A. Seen on a retrieved page** (page shown):

- `biryani`: biriyani (Wikipedia: Biryani, Hebbar's Kitchen (matka biryani)); briyani (Wikipedia: Biryani); बिर्याणी (Wikipedia API langlinks (mr), Wikidata labels/aliases); बिरयानी (Wikipedia: Biryani, Hebbar's Kitchen (chole bhature))
- `samosa`: samosas (Wikipedia: Samosa, Wikipedia: Jalebi); singara (Wikipedia: Samosa); shingara (Wikipedia: Samosa); singada (Wikipedia: Samosa, Wikidata labels/aliases); समोसा (Wikipedia: Samosa, Hebbar's Kitchen (veg mutton biryani)); सामोसा (Wikipedia API langlinks (mr), Wikidata labels/aliases)
- `vada-pav`: wada pav (Wikidata labels/aliases); vada paav (Wikipedia: Vada pav); wada pao (Wikipedia: Vada pav, Wikidata labels/aliases); vadapav (Wikipedia: Maharashtrian cuisine, Wikidata labels/aliases); vada pao (Wikidata labels/aliases); bombay burger (Wikipedia: Vada pav, Wikipedia: Hamburger); वडापाव (Wikipedia API langlinks (mr), Wikidata labels/aliases); वड़ा पाव (Hebbar's Kitchen (misal pav), Wikidata labels/aliases); वड़ापाव (Wikipedia API langlinks (hi), Wikidata labels/aliases)
- `misal-pav`: misal (Wikipedia: Misal pav, Wikipedia: Maharashtrian cuisine); misalpav (Wikipedia: Maharashtrian cuisine); मिसळ पाव (Wikipedia API langlinks (mr)); मिसळपाव (Wikipedia: Misal pav, Wikidata labels/aliases); मिसळ (Wikipedia: Misal pav, Wikipedia: Misal); मिसल पाव (Hebbar's Kitchen (misal pav))
- `momos`: momo (Wikipedia: Momo (food), Prabhat Khabar (momos)); मोमो (Wikipedia: Momo (food), Prabhat Khabar (momos)); मोमोज (Prabhat Khabar (momos), Hebbar's Kitchen (paneer momos)); मोमोज़ (Hebbar's Kitchen (paneer momos))
- `dosa`: dosai (Wikipedia: Dosa (food), Wikidata labels/aliases); thosai (Wikipedia: Dosa (food), Wikidata labels/aliases); dose (Wikipedia: Dosa (food), Hebbar's Kitchen (masala dosa)); डोसा (Hebbar's Kitchen (chole bhature), Hebbar's Kitchen (masala dosa)); दोसा (Hebbar's Kitchen (masala dosa), Hebbar's Kitchen (veg mutton biryani))
- `pizza`: pizzas (Wikipedia: Pizza); पिझ्झा (Wikipedia API langlinks (mr), Wikidata labels/aliases); पिज़्ज़ा (Wikipedia API langlinks (hi), Wikidata labels/aliases); पिज्जा (Hebbar's Kitchen (misal pav))
- `burger`: burgers (Wikipedia: Hamburger, Wikipedia: Sandwich); hamburger (Wikipedia: Hamburger, Wikipedia: Sandwich); hamburgers (Wikipedia: Hamburger, Wikipedia: Sandwich); बर्गर (Wikipedia API langlinks (hi), Wikidata labels/aliases); ह्यामबर्गर (Wikidata labels/aliases); हैमबर्गर (Wikipedia API langlinks (hi), Wikidata labels/aliases)
- `poha`: pohe (Wikipedia: Maharashtrian cuisine, Wikipedia: Misal); pohay (Wikipedia: Maharashtrian cuisine, Wikipedia: Poha (disambiguation)); kanda poha (Wikipedia: Maharashtrian cuisine); kanda pohe (Wikipedia: Maharashtrian cuisine); batata pohe (Wikipedia: Maharashtrian cuisine); flattened rice (Wikipedia: Maharashtrian cuisine, Wikipedia: Flattened rice); पोहे (Prabhat Khabar (poha), Hebbar's Kitchen (misal pav)); पोहा (Prabhat Khabar (poha), Hebbar's Kitchen (masala dosa))
- `pav-bhaji`: pao bhaji (Wikipedia: Pav bhaji, Wikidata labels/aliases); bhaji pav (Wikidata labels/aliases); पाव भाजी (Wikipedia: Pav bhaji, Hebbar's Kitchen (misal pav))
- `shawarma`: shawerma (Wikidata labels/aliases); शोरमा (Wikipedia API langlinks (mr), Wikidata labels/aliases); शवर्मा (Wikipedia API langlinks (hi)); शावरमा (Wikidata labels/aliases); शॉरमा (Wikidata labels/aliases)
- `chole-bhature`: channa bhatura (Wikipedia: Chole bhature); छोले भटूरे (Hebbar's Kitchen (chole bhature), Wikipedia API langlinks (hi))
- `thali`: bhojanam (Wikipedia: Thali); थाली (Wikipedia: Thali, Amarkosh); थाळी (Amarkosh)
- `kebab`: kabab (Wikipedia: Kebab, Wikipedia: Seekh kebab); kebap (Wikipedia: Kebab, Wikidata labels/aliases); kabob (Wikipedia: Kebab); kebob (Wikipedia: Kebab); कबाब (Wikipedia: Kebab, Hebbar's Kitchen (chole bhature))
- `sandwich`: sandwiches (Wikipedia: Sandwich, Wikipedia: Bombay sandwich); सैंडविच (Hebbar's Kitchen (chole bhature), Hebbar's Kitchen (masala dosa))
- `desserts`: dessert (Wikipedia: Dessert, Wikipedia: Gulab jamun); sweets (Wikipedia: Dessert, Wikipedia: Gulab jamun); sweet dish (Wikipedia: Dessert, Wikipedia: Maharashtrian cuisine); mithai (Wikipedia: Dessert, Wikipedia: Gulab jamun); मिठाई (Hebbar's Kitchen (chole bhature), Hebbar's Kitchen (masala dosa)); मिष्ठान्न (Wikidata labels/aliases)
- `chicken-biryani`: चिकन बिरयानी (Patrika (chicken biryani), Prabhat Khabar (momos))
- `mutton-biryani`: मटन बिरयानी (Kerala Tourism (mutton biryani), Hebbar's Kitchen (matka biryani))
- `veg-biryani`: वेज बिरयानी (Hebbar's Kitchen (matka biryani), Patrika (chicken biryani))
- `veg-momos`: veg momo (Prabhat Khabar (momos)); vegetable momos (Wikipedia: Momo (food), Prabhat Khabar (momos)); वेज मोमोज (Prabhat Khabar (momos), Hebbar's Kitchen (paneer momos))
- `masala-dosa`: मसाला डोसा (Hebbar's Kitchen (masala dosa)); मसाला दोसा (Wikipedia API langlinks (hi), Wikidata labels/aliases)
- `puneri-misal-pav`: puneri misal (Wikipedia: Misal pav, Wikipedia: Puneri misal); pune misal (Wikipedia: Misal pav)
- `kolhapuri-misal-pav`: kolhapuri misal (Wikipedia: Misal, Wikipedia: Misal pav)
- `seekh-kebab`: seekh kabab (Wikipedia: Seekh kebab); सीख़ कबाब (Wikipedia: Kebab, Wikipedia API langlinks (hi)); सींक कबाब (Wikidata labels/aliases)
- `veg-burger`: veggie burger (Wikipedia: Hamburger, Wikipedia: Vada pav)

**B. Plain transliteration or search variants not seen on any retrieved page** (no factual claim; the owner may prune; these exist only so typed or voice queries such as "missal pav" or "biriyani" resolve):

- `biryani`: biriani, biryaani
- `samosa`: samossa
- `vada-pav`: वडा पाव
- `misal-pav`: missal, missal pav, misal paav
- `momos`: momoz
- `poha`: batata poha
- `pav-bhaji`: paav bhaji, pav bhaaji, पावभाजी
- `shawarma`: shwarma, shawarma roll
- `chole-bhature`: chole bhatura, chhole bhature, choley bhature, chana bhatura, छोले भटुरे
- `thali`: thaali
- `kebab`: kabaab
- `sandwich`: सँडविच
- `chicken-biryani`: chicken biriyani, chicken briyani, चिकन बिर्याणी
- `mutton-biryani`: mutton biriyani, mutton briyani, goat biryani, मटण बिर्याणी
- `veg-biryani`: vegetable biryani, veg biriyani, veggie biryani, vegetarian biryani, व्हेज बिर्याणी
- `chicken-momos`: chicken momo, चिकन मोमोज
- `veg-momos`: vegetarian momos, व्हेज मोमोज
- `masala-dosa`: masala dosai, masala thosai, masale dose
- `chicken-shawarma`: chicken shwarma, chicken shawerma, chicken shawarma roll
- `puneri-misal-pav`: pune misal pav, puneri missal, पुणेरी मिसळ
- `kolhapuri-misal-pav`: kolhapuri missal, कोल्हापुरी मिसळ
- `seekh-kebab`: sheekh kebab, sheekh kabab, seekh kabaab, सीख कबाब
- `veg-burger`: vegetable burger, vegetarian burger
- `chicken-burger`: chicken burgers

Counts: 93 aliases seen on a page, 56 unsourced variants.

## 6. Marathi and Hindi names (`i18n`)

A name is filled only when the exact string appears in a retrieved Wikipedia title, a Wikidata label or alias, or a publisher page title or description. Otherwise it is `null` (the contract allows this) and the gap is logged. Names were NFKC-normalised, so a nukta may be stored as base letter plus U+093C.

- `biryani` mr: **बिर्याणी**. Marathi Wikipedia article title linked from en:Biryani (API langlinks); Wikidata Q271555 mr label.
- `biryani` hi: **बिरयानी**. Hindi Wikipedia article title linked from en:Biryani; Wikidata Q271555 hi label; also in the en:Biryani lead (Hindi: बिरयानी).
- `samosa` mr: **सामोसा**. Marathi Wikipedia title linked from en:Samosa; Wikidata Q491517 mr label.
- `samosa` hi: **समोसा**. Hindi Wikipedia title linked from en:Samosa; en:Samosa lead (Hindi: समोसा).
- `vada-pav` mr: **वडापाव**. Marathi Wikipedia title linked from en:Vada pav; Wikidata Q2985347 mr label.
- `vada-pav` hi: **वड़ापाव**. Hindi Wikipedia title linked from en:Vada pav; Wikidata Q2985347 hi label.
- `misal-pav` mr: **मिसळ पाव**. Marathi Wikipedia title linked from en:Misal pav (also en:Misal pav lead: Marathi: मिसळपाव).
- `misal-pav` hi: **मिसल पाव**. Hebbar's Kitchen Hindi page title: मिसल पाव रेसिपी | misal pav recipe in hindi | महाराष्ट्रीयन मिसल पाव.
- `momos` hi: **मोमो**. Hindi Wikipedia title linked from en:Momo (food); Wikidata Q134092 hi label.
- `dosa` mr: **डोसा**. Marathi Wikipedia title linked from en:Dosa (food); Wikidata Q920940 mr label.
- `dosa` hi: **डोसा**. Hebbar's Kitchen Hindi masala-dosa page title (मसाला डोसा); Hindi Wikipedia / Wikidata use the spelling दोसा, kept as an alias.
- `pizza` mr: **पिझ्झा**. Marathi Wikipedia title linked from en:Pizza; Wikidata Q177 mr label.
- `pizza` hi: **पिज़्ज़ा**. Hindi Wikipedia title linked from en:Pizza; Wikidata Q177 hi label.
- `burger` mr: **बर्गर**. Wikidata Q6663 mr alias (label is ह्यामबर्गर, kept as an alias).
- `burger` hi: **बर्गर**. Wikidata Q6663 hi alias (label is हैमबर्गर, kept as an alias).
- `poha` mr: **पोहे**. Marathi Wikipedia title linked from en:Flattened rice; Wikidata Q2724236 mr label.
- `poha` hi: **पोहा**. Prabhat Khabar Hindi poha page (title and text use पोहा).
- `pav-bhaji` mr: **पाव भाजी**. Marathi Wikipedia title linked from en:Pav bhaji; en:Pav bhaji lead (Marathi: पाव भाजी).
- `pav-bhaji` hi: **पाव भाजी**. Hindi Wikipedia title linked from en:Pav bhaji; Wikidata Q3629971 hi label.
- `shawarma` mr: **शोरमा**. Marathi Wikipedia title linked from en:Shawarma; Wikidata Q3412448 mr label.
- `shawarma` hi: **शवर्मा**. Hindi Wikipedia title linked from en:Shawarma (Wikidata hi label is शावरमा, kept as an alias).
- `chole-bhature` hi: **छोले भटूरे**. Hindi Wikipedia title linked from en:Chole bhature; Hebbar's Kitchen Hindi page title.
- `thali` mr: **थाळी**. Amarkosh Marathi dictionary entry थाळी.
- `thali` hi: **थाली**. en:Thali lead (Hindi: थाली); Wikidata Q1642148 hi label.
- `kebab` mr: **कबाब**. Marathi Wikipedia title linked from en:Kebab; Wikidata Q179010 mr label.
- `kebab` hi: **कबाब**. Hindi Wikipedia title linked from en:Kebab; Wikidata Q179010 hi alias.
- `sandwich` hi: **सैंडविच**. Hindi Wikipedia title linked from en:Sandwich; Wikidata Q28803 hi label.
- `desserts` hi: **मिष्टान्न**. Hindi Wikipedia title linked from en:Dessert (Wikidata Q182940 hi label is मिठाई, kept as an alias).
- `chicken-biryani` hi: **चिकन बिरयानी**. Patrika Hindi page title/headline: ...ऐसे बनाएं चिकन बिरयानी.
- `mutton-biryani` hi: **मटन बिरयानी**. Kerala Tourism Hindi page title: मलबार मटन बिरयानी की रेसिपी....
- `veg-biryani` hi: **वेज बिरयानी**. Hebbar's Kitchen Hindi page title: ...मटका वेज बिरयानी.
- `veg-momos` hi: **वेज मोमोज**. Prabhat Khabar Hindi momos page description: ...हेल्दी वेज मोमोज.
- `masala-dosa` hi: **मसाला डोसा**. Hebbar's Kitchen Hindi page title: मसाला डोसा रेसिपी ...; Hindi Wikipedia / Wikidata Q11771087 use मसाला दोसा, kept as an alias.
- `seekh-kebab` hi: **सीख़ कबाब**. Hindi Wikipedia title linked from en:Seekh kebab (सीख़ कबाब).

**Gaps (left `null`):**

- `momos` (mr), `chole-bhature` (mr), `sandwich` (mr), `desserts` (mr), `chicken-biryani` (mr), `mutton-biryani` (mr), `veg-biryani` (mr), `chicken-momos` (mr/hi), `veg-momos` (mr), `masala-dosa` (mr), `chicken-shawarma` (mr/hi), `puneri-misal-pav` (mr/hi), `kolhapuri-misal-pav` (mr/hi), `seekh-kebab` (mr), `veg-burger` (mr/hi), `chicken-burger` (mr/hi)
- Reason: Marathi Wikipedia has no article linked from en:Momo, en:Thali, en:Sandwich, en:Dessert, en:Chole bhature, en:Masala dosa, en:Seekh kebab or en:Bombay sandwich (the Marathi thali name comes from a Marathi dictionary instead), and the Marathi-language searches returned only Hindi or English pages. Compound variant names (for example `chicken-momos`, `chicken-shawarma`, Puneri and Kolhapuri misal) were not found as a complete string on any page. To fill them in Wave 12 (Marathi/Hindi) with a native-speaker check rather than composing them here.

## 7. Editorial fields (not claims about reality)

These four fields are catalogue parameters chosen by the task, not statements about what a dish costs or how it is classified by a source. They need owner review but no citation.

- **`price_bands_inr`**: ascending integer thresholds for the `under-₹N` intent pages and filters. Round numbers picked so each dish gets 3 useful steps; biryani uses the card's example `[200, 300, 500]`. They are not prices of any menu item. The `veg-*`, `chicken-*` and `mutton-*` variants use bands one step lower or higher than the parent where the protein plausibly shifts the ladder; this is a UI choice only.
- **`price_sanity_inr`**: deliberately very wide per-serving bounds, used only to REJECT absurd extracted prices (for example ₹5 or ₹50,000 for a biryani). They are not an estimate of a typical price, and no restaurant or price was looked up. If real extracted evidence later shows legitimate prices outside a range, widen it; do not narrow it without evidence.
- **`diet`**: `veg` where a retrieved page calls the dish vegetarian or describes it as made of vegetables or legumes (vada pav, misal and both misal variants, pav bhaji, poha, chole bhature, dosa and masala dosa, `veg-*` variants; Wikipedia also files Misal pav, Puneri misal and Masala dosa under "Vegetarian dishes of India"). `non_veg` where the dish is meat by definition (shawarma and chicken/mutton variants). `both` where pages show meat and vegetarian forms (biryani, samosa, momos, thali, seekh kebab, sandwich, burger) or where the dish is a broad category whose fillings and toppings vary (pizza, kebab, desserts: cakes and ice cream may contain egg and no retrieved page settles it). Downstream, `both` means "no claim", never a veg guarantee.
- **`cravings`**: the spec §9 example fixes `spicy` for biryani, kebab and shawarma. `spicy` is added elsewhere only where a retrieved page calls the dish spicy (misal, vada pav chutney, pav bhaji, Kolhapuri misal, seekh kebab spices). `breakfast` follows pages that call the dish a breakfast item (poha, misal, dosa, masala dosa, chole bhature). `street` follows pages that call it a street food (samosa as a snack, vada pav, pav bhaji, shawarma, chole bhature, momos via "street style" in Prabhat Khabar). `light` for poha follows Prabhat Khabar ("कुछ हल्का खाने का मन करे"); for sandwich it is an editorial guess. `filling`, `savoury` and `sweet` are editorial (`sweet` appears only on `desserts`). `late_night` and `healthy` are not used: no retrieved page supports them.
- **Variants** are limited to those a page attests as real named versions: biryani by protein (Biryani page), momos by filling (Momo page), masala dosa, chicken shawarma, seekh kebab, veg and chicken burger (Hamburger page, India section), Puneri and Kolhapuri misal (own Wikipedia article / Misal and Misal pav pages). `bombay-sandwich` was left out: its page says it is "not as popular" outside Mumbai.

## 8. Queries and fetches

WebSearch (standard mode), 10 of 20 budget:

1. `Puneri misal vs Kolhapuri misal difference Maharashtra`: Pointed to en.wikipedia `Puneri_misal` and `Misal` (opened by curl); other results were blogs seen as titles only.
2. `चिकन बिर्याणी मटण बिर्याणी व्हेज बिर्याणी रेसिपी`: No Marathi page; Patrika Hindi chicken biryani page (opened by curl).
3. `इंदौरी पोहा रेसिपी`: Prabhat Khabar Indori poha page (opened by curl).
4. `मिसल पाव रेसिपी हिंदी महाराष्ट्र`: Hebbar's Kitchen Hindi misal pav page (opened by curl).
5. `मोमोज रेसिपी मराठी व्हेज मोमोज`: No Marathi page; Prabhat Khabar and Hebbar's Kitchen Hindi momos pages (opened by curl).
6. `मराठी थाळी जेवण महाराष्ट्रीयन थाळी`: Amarkosh Marathi dictionary entry (opened by curl).
7. `छोले भटुरे रेसिपी मराठी`: No Marathi page; Hebbar's Kitchen Hindi chole bhature page (opened by curl).
8. `मसाला डोसा रेसिपी मराठी`: No Marathi page; Hebbar's Kitchen Hindi masala dosa page (opened by curl).
9. `चिकन बिर्याणी मराठी रेसिपी मटण बिर्याणी`: No Marathi page; nothing new used.
10. `मटन बिरयानी वेज बिरयानी रेसिपी हिंदी`: Kerala Tourism Hindi mutton biryani page and Hebbar's Kitchen matka biryani page (opened by curl).

curl fetches: 30 Wikipedia page fetches (24 cited, 6 not cited), 3 Wikipedia API calls (langlinks `mr`, langlinks `hi`, pageprops), 1 Wikidata API call, 11 publisher pages (Hebbar's Kitchen x6, Prabhat Khabar x2, Patrika, Kerala Tourism, Amarkosh). Seven Britannica URLs returned 403. Wikimedia answered HTTP 429 to a few rapid requests; those were retried after a pause and no content from a 429 response was used.

## 9. Gaps and flags for the orchestrator

1. **Contract gap (needs an orchestrator decision).** CONTRACTS §4 `Dish` has no `sources: SourceRef[]` field, but the product rule says every rendered claim shows its source and the date it was checked. Descriptions are therefore sourced only in this log. Suggest adding `sources: SourceRef[]` (>= 1) to `Dish` and `DishSchema` before dish pages render descriptions; the quotes in section 4 are ready to be turned into `SourceRef` rows (all `retrieved_at` = 2026-10-13). This task did not change the contract or the schema.
2. **Single-publisher descriptions.** General dish facts rest on Wikipedia; Britannica was blocked (403). The owner review should treat them as unverified until opened.
3. **Marathi and Hindi gaps** listed in section 6. Fill in Wave 12.
4. **Unsourced editorial fields** (`price_bands_inr`, `price_sanity_inr`, most `cravings`, `diet: both`): section 7. No price evidence exists for any dish; bands and bounds are placeholders for the UI and the extraction sanity check.
5. **Kolhapuri misal and pav.** The Misal article says the Kolhapuri version is traditionally served with thick bread slices, not pav, while the Misal pav article describes "misal pav from Kolhapur". The id `kolhapuri-misal-pav` follows the `{variant}-{parent}` rule; the description reports both statements.
6. **Wikipedia inconsistency noted, not used.** The Chole bhature page says chole is cooked in a gravy of tomatoes, onions and spices and, in the next sentence, that chole "does not use tomatoes". The description avoids naming the gravy ingredients.
7. **No WhatsApp number or phone number** appears in `dishes.json` (checked by script). No restaurant or business name appears either (checked by reading; the Phadtare misal brand named on the Misal page was deliberately left out).

