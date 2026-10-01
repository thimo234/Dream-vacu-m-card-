# Dreame Compact Card

Een compacte Nederlandstalige Home Assistant-kaart met kamerselectie, batterijstatus, pauze en terug naar het laadstation. Ontworpen voor jouw vierkante SONOFF NSPanel Pro en de Dreame-integratie van Tasshack. Geen externe JavaScript-afhankelijkheden of buildstap.

## Voorwaarden

- Je vierkante NSPanel Pro moet het Home Assistant-dashboard in een browser weergeven.
- Een werkende Dreame-integratie met de actie `dreame_vacuum.vacuum_clean_segment` en parameter `segments`. Controleer dit in Ontwikkelaarstools → Acties. Niet iedere Dreame-integratie biedt dezelfde acties.
- De vacuum-entiteit en numerieke kamer-ID's van je huidige robotkaart. Gebruik de ID's uit de integratie; onderstaande nummers zijn voorbeelden. Na opnieuw indelen van kamers of wisselen van verdieping kunnen andere ID's nodig zijn.

## Installeren via HACS

Repository: https://github.com/thimo234/Dream-vacu-m-card-

1. Kopieer de repository-URL hierboven.
2. Open HACS → menu → Aangepaste repositories. Voeg de URL van die repository toe met type Dashboard.
3. Download Dreame Compact Card en herlaad de browser.
4. Als de resource niet automatisch is toegevoegd, voeg onder Dashboard-resources `/hacsfiles/Dream-vacu-m-card-/dreame-compact-card.js` toe met type JavaScript-module.
5. Kies in je dashboard Bewerken → Kaart toevoegen → Dreame Compact Card.
6. Kies je stofzuiger, stel de titel en hoogte in en klik op **Kamer toevoegen**. Vul per kamer het ID, de naam en eventueel een `mdi:`-icoon in. Klik daarna op Opslaan. YAML is niet nodig.

De editor toont alle vacuum-entiteiten: kies degene van de Tasshack-integratie. Kamer-ID’s moeten nog handmatig worden ingevuld; de kaart haalt ze niet automatisch uit de robot. Dubbele of ongeldige ID’s worden tegengehouden. Bij een nieuwe kaart worden geen voorbeeldkamers opgeslagen die per ongeluk de verkeerde ruimte zouden kunnen starten.

### Optioneel: YAML

```yaml
type: custom:dreame-compact-card
entity: vacuum.jouw_dreame
title: Dreame
height: 360
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

Selecteer kamers en druk op Start. Een lege selectie kan nooit een schoonmaakopdracht versturen. Tijdens een lopende aanvraag worden knoppen geblokkeerd. Na een geslaagde aanvraag wordt de selectie gewist; bij een fout blijft deze behouden. 'Opdracht verstuurd' bevestigt alleen dat Home Assistant de aanvraag heeft geaccepteerd. Bij schoonmaken, terugkeren of een storing is een nieuwe kameropdracht geblokkeerd. Pauze en laadstation gebruiken de standaard `vacuum`-acties.

## Handmatig testen zonder HACS

Kopieer `dreame-compact-card.js` naar `/config/www/` en voeg `/local/dreame-compact-card.js` toe als JavaScript-module bij Dashboard-resources. Gebruik daarna dezelfde YAML.

## Ontwikkeling en verificatie

Voer `npm test` en `npm run check` uit met Node.js. De tests controleren servicegegevens, lege selectie, foutafhandeling en dubbele aanvragen. Er is nog geen test uitgevoerd in een echte Home Assistant-installatie of op een SONOFF-display.

Bronnen: [Home Assistant custom cards](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/), [HACS Dashboard-repositoryvereisten](https://www.hacs.xyz/docs/publish/plugin/), [Dreame-integratie](https://github.com/Tasshack/dreame-vacuum).
