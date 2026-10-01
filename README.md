# Dreame Compact Card

Een compacte Nederlandstalige Home Assistant-kaart met kamerselectie, batterijstatus, pauze en terug naar het laadstation. Ontworpen voor jouw vierkante SONOFF NSPanel Pro en de Dreame-integratie van Tasshack. Geen externe JavaScript-afhankelijkheden of buildstap.

## Voorwaarden

Voor zes kamers kun je de hoogte in de editor op **400 pixels** zetten. De zes tegels en de extra tegel **Alle ruimtes** passen dan zonder scrollen, met de bedieningsknoppen zichtbaar.

- Je vierkante NSPanel Pro moet het Home Assistant-dashboard in een browser weergeven.
- Een werkende Dreame-integratie met de actie `dreame_vacuum.vacuum_clean_segment` en parameter `segments`. Controleer dit in Ontwikkelaarstools → Acties. Niet iedere Dreame-integratie biedt dezelfde acties.
- De vacuum-entiteit, kaartcamera met `rooms` en select-entiteit voor `cleaning_mode` van je robot. De kaart probeert bijbehorende entiteiten automatisch te vinden; je kunt de camera en reinigingsmodus ook kiezen in de editor.

## Installeren via HACS

Repository: https://github.com/thimo234/Dream-vacu-m-card-

1. Kopieer de repository-URL hierboven.
2. Open HACS → menu → Aangepaste repositories. Voeg de URL van die repository toe met type Dashboard.
3. Download Dreame Compact Card en herlaad de browser.
4. Als de resource niet automatisch is toegevoegd, voeg onder Dashboard-resources `/hacsfiles/Dream-vacu-m-card-/dreame-compact-card.js` toe met type JavaScript-module.
5. Kies in je dashboard Bewerken → Kaart toevoegen → Dreame Compact Card.
6. Kies je stofzuiger en laat **Kamers** op **Automatisch uit de robotkaart** staan. Stel eventueel de titel en hoogte in en klik op Opslaan. YAML is niet nodig.

De editor gebruikt de doorzoekbare entiteitskiezer van Home Assistant. Zoek op naam of entiteits-ID. Stofzuigers, camera’s met kamergegevens, reinigingsmodus-selects en CleanGenius-selects worden per veld gefilterd. Als apparaat- en integratiegegevens beschikbaar zijn, worden andere integraties en entiteiten van een andere robot uitgesloten. Wis een optionele keuze om terug te gaan naar automatische herkenning.

Kamernamen en ID’s worden uit het `rooms`-attribuut van de kaartcamera gelezen. Zonder cameragegevens gebruikt de kaart de kamers van `selected_map` op de vacuum-entiteit. Bij het wisselen van verdieping wordt de selectie gewist. De kamertegels en knoppen behouden hun bestaande uiterlijk.

Als er geen kamers verschijnen, kies je in de editor de juiste **Kaartcamera**. De kaart gebruikt automatisch de gebruikelijke entiteitsnaam of een bijbehorende entiteit van hetzelfde apparaat; hij kiest niet zomaar een camera van een andere robot. Je kunt via **Kamer toevoegen** ook kamers handmatig invullen als terugval. Kies **Handmatig ingevulde kamers** om uitsluitend deze lijst te gebruiken.

### Alleen stofzuigen of ook dweilen

Selecteer kamers en druk op **Alleen zuigen** of **Zuigen + dweilen**. Deze knoppen starten direct de geselecteerde kamers in de gekozen modus. Er is geen losse modusselector of startknop meer. De tegel **Alle ruimtes** selecteert alle kamers van de huidige verdieping; deze selectie start op zichzelf geen reiniging. Je kunt daarna individuele kamers deselecteren. Zonder selectie zijn beide startknoppen uitgeschakeld. Kamernamen en de bestaande kamertegels blijven behouden.

Voor elke start zet de kaart eerst de gevonden **CleanGenius**-select op uit, daarna de reinigingsmodus op alleen zuigen of zuigen met dweilen, en vervolgens start hij de geselecteerde kamers. Actieve aangepaste kamerreiniging wordt ook uitgeschakeld. Als een stap mislukt, start de kaart geen reiniging en toont hij een fout. Nederlandse en Engelse opties worden herkend, waaronder `Uit` / `Off`, `Stofzuigen` / `Sweeping` en `Stofzuigen en dweilen` / `Sweeping and mopping`.

Kies bij hernoemde entiteiten in de editor **CleanGenius-entiteit** en **Reinigingsmodus-entiteit**. Voor jouw installatie zijn dit `select.stofzuiger_cleangenius` en `select.stofzuiger_cleaning_mode`. De drie optievelden in de editor bevatten de opties die deze entiteiten daadwerkelijk aanbieden. Je kunt daarin expliciet de uit-optie, stofzuigen en zuigen met dweilen selecteren als automatische herkenning niet werkt. Het apparaat moet de gekozen modus ondersteunen.

### Optioneel: YAML

```yaml
type: custom:dreame-compact-card
entity: vacuum.jouw_dreame
title: Dreame
height: 360
auto_rooms: true
# Optioneel bij hernoemde entiteiten:
# map_entity: camera.jouw_dreame_map
# cleaning_mode_entity: select.jouw_dreame_cleaning_mode
# cleangenius_entity: select.jouw_dreame_cleangenius
```

Optioneel een handmatige kamerlijst:

```yaml
type: custom:dreame-compact-card
entity: vacuum.jouw_dreame
auto_rooms: false
rooms:
  - id: 1
    name: Woonkamer
    icon: mdi:sofa
  - id: 2
    name: Keuken
    icon: mdi:countertop
  - id: 3
    name: Hal
    icon: mdi:door
  - id: 4
    name: Slaapkamer
    icon: mdi:bed
```

Je kunt de visuele editor of YAML gebruiken. Voor schoonmaken zijn `entity` en minimaal één kamer nodig. `title`, `height` (260–1200 CSS-pixels) en kamericonen zijn optioneel. De standaardhoogte is 360 pixels. De kaart neemt de beschikbare breedte in; richtwaarde minimaal 280 CSS-pixels. De kamerknoppen staan in twee kolommen en de kamerlijst scrolt bij meer kamers. Houd rekening met de Home Assistant-kopbalk, dashboardmarges en browserzoom bij het kiezen van de hoogte. Een schermresolutie is niet altijd gelijk aan de beschikbare ruimte in CSS-pixels.

Selecteer kamers en druk op een van de twee reinigingsknoppen. Een lege selectie kan nooit een schoonmaakopdracht versturen. Tijdens een lopende aanvraag worden knoppen geblokkeerd. Na een geslaagde aanvraag wordt de selectie gewist; bij een fout blijft deze behouden. 'Opdracht verstuurd' bevestigt alleen dat Home Assistant de aanvraag heeft geaccepteerd. Bij schoonmaken, terugkeren of een storing is een nieuwe kameropdracht geblokkeerd. Pauze en laadstation gebruiken de standaard `vacuum`-acties.

## Handmatig testen zonder HACS

Kopieer `dreame-compact-card.js` naar `/config/www/` en voeg `/local/dreame-compact-card.js` toe als JavaScript-module bij Dashboard-resources. Gebruik daarna dezelfde YAML.

## Ontwikkeling en verificatie

Voer `npm test` en `npm run check` uit met Node.js. De tests controleren servicegegevens, lege selectie, foutafhandeling en dubbele aanvragen. Er is nog geen test uitgevoerd in een echte Home Assistant-installatie of op een SONOFF-display.

Bronnen: [Home Assistant custom cards](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/), [HACS Dashboard-repositoryvereisten](https://www.hacs.xyz/docs/publish/plugin/), [Dreame-integratie](https://github.com/Tasshack/dreame-vacuum).
