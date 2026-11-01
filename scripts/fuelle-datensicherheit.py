# -*- coding: utf-8 -*-
"""Füllt die Datensicherheits-Vorlage der Play Console aus.

Grundlage ist, was die App wirklich tut:
  - Ohne Konto verlässt nichts das Gerät (Gastmodus).
  - Mit Konto: E-Mail (Anmeldung), selbst gewählter Benutzername,
    Spielstände. Alles bei Supabase, dem Auftragsverarbeiter.
  - Keine Werbung, kein Tracking, keine Weitergabe an Dritte.
"""
import csv, sys

QUELLE = sys.argv[1]
ZIEL = sys.argv[2]
LOESCH_URL = 'https://te-mini-games.pages.dev/konto-loeschen'

# Die Datenarten, die wir erheben.
#
# PSL_NAME ist dabei die eine Ermessensfrage: Die App fragt nie nach einem
# echten Namen, und der Trigger in 001 liest nur `display_name`, das Google
# gar nicht setzt -- angezeigt wird also "Spieler". Bei der Anmeldung mit
# Google schickt Google den Namen aber mit, und Supabase legt ihn in
# auth.users.raw_user_meta_data ab. Erhoben ist er damit, auch wenn ihn
# niemand sieht. Zu viel anzugeben ist kein Verstoss, zu wenig schon.
ERHOBEN = {
    'PSL_NAME':             ['PSL_APP_FUNCTIONALITY', 'PSL_ACCOUNT_MANAGEMENT'],
    'PSL_EMAIL':            ['PSL_APP_FUNCTIONALITY', 'PSL_ACCOUNT_MANAGEMENT'],
    'PSL_USER_ACCOUNT':     ['PSL_APP_FUNCTIONALITY', 'PSL_ACCOUNT_MANAGEMENT'],
    'PSL_USER_INTERACTION': ['PSL_APP_FUNCTIONALITY'],
}

# Die Auswahlfelder, in denen die Datenarten angekreuzt werden.
DATENART_FRAGEN = {
    'PSL_DATA_TYPES_PERSONAL', 'PSL_DATA_TYPES_FINANCIAL', 'PSL_DATA_TYPES_LOCATION',
    'PSL_DATA_TYPES_SEARCH_AND_BROWSING', 'PSL_DATA_TYPES_EMAIL_AND_TEXT',
    'PSL_DATA_TYPES_PHOTOS_AND_VIDEOS', 'PSL_DATA_TYPES_AUDIO',
    'PSL_DATA_TYPES_HEALTH_AND_FITNESS', 'PSL_DATA_TYPES_CONTACTS',
    'PSL_DATA_TYPES_CALENDAR', 'PSL_DATA_TYPES_APP_PERFORMANCE',
    'PSL_DATA_TYPES_FILES_AND_DOCS', 'PSL_DATA_TYPES_APP_ACTIVITY',
    'PSL_DATA_TYPES_IDENTIFIERS',
}

# Einzelantworten ohne Datenart-Bezug.
EINFACH = {
    ('PSL_DATA_COLLECTION_COLLECTS_PERSONAL_DATA', ''): 'TRUE',
    ('PSL_DATA_COLLECTION_ENCRYPTED_IN_TRANSIT', ''): 'TRUE',

    # Anmeldung: E-Mail mit Passwort, dazu "Mit Google anmelden".
    ('PSL_SUPPORTED_ACCOUNT_CREATION_METHODS', 'PSL_ACM_USER_ID_PASSWORD'): 'TRUE',
    ('PSL_SUPPORTED_ACCOUNT_CREATION_METHODS', 'PSL_ACM_USER_ID_OTHER_AUTH'): 'FALSE',
    ('PSL_SUPPORTED_ACCOUNT_CREATION_METHODS', 'PSL_ACM_USER_ID_PASSWORD_OTHER_AUTH'): 'FALSE',
    ('PSL_SUPPORTED_ACCOUNT_CREATION_METHODS', 'PSL_ACM_OAUTH'): 'TRUE',
    ('PSL_SUPPORTED_ACCOUNT_CREATION_METHODS', 'PSL_ACM_OTHER'): 'FALSE',
    ('PSL_SUPPORTED_ACCOUNT_CREATION_METHODS', 'PSL_ACM_NONE'): 'FALSE',

    ('PSL_ACCOUNT_DELETION_URL', ''): LOESCH_URL,

    ('PSL_SUPPORT_DATA_DELETION_BY_USER', 'DATA_DELETION_YES'): 'TRUE',
    ('PSL_SUPPORT_DATA_DELETION_BY_USER', 'DATA_DELETION_NO'): 'FALSE',
    ('PSL_SUPPORT_DATA_DELETION_BY_USER', 'DATA_DELETION_NO_AUTO_DELETED'): 'FALSE',
    ('PSL_DATA_DELETION_URL', ''): LOESCH_URL,

    # Keine unabhängige Sicherheitsprüfung nach MASA -- also auch kein Logo.
    ('PSL_INDEPENDENTLY_VALIDATED', ''): 'FALSE',

    # Mit Google meldet man sich mit einem Konto an, das es schon gibt.
    ('PSL_HAS_OUTSIDE_APP_ACCOUNTS', ''): 'TRUE',
    ('PSL_OUTSIDE_APP_ACCOUNT_TYPES', 'PSL_LOGIN_WITH_OUTSIDE_APP_ID'): 'TRUE',
    ('PSL_OUTSIDE_APP_ACCOUNT_TYPES', 'PSL_LOGIN_THROUGH_EMPLOYMENT_OR_ENTERPRISE_ACCOUNT'): 'FALSE',
    ('PSL_OUTSIDE_APP_ACCOUNT_TYPES', 'PSL_OUTSIDE_APP_ACCOUNT_TYPE_OTHER'): 'FALSE',
}


def wert(frage, antwort):
    """Gibt den Wert für eine Zeile zurück -- oder None für 'leer lassen'."""
    if (frage, antwort) in EINFACH:
        return EINFACH[(frage, antwort)]

    # Ankreuzfelder der Datenarten: genau drei TRUE, der Rest ausdrücklich FALSE.
    if frage in DATENART_FRAGEN:
        return 'TRUE' if antwort in ERHOBEN else 'FALSE'

    if frage.startswith('PSL_DATA_USAGE_RESPONSES:'):
        _, art, unterfrage = frage.split(':', 2)
        # Datenarten, die wir nicht erheben, werden gar nicht erst gefragt.
        if art not in ERHOBEN:
            return None
        if unterfrage == 'PSL_DATA_USAGE_COLLECTION_AND_SHARING':
            # Erhoben ja, geteilt nein. Supabase ist Auftragsverarbeiter,
            # und das zählt bei Google nicht als Weitergabe an Dritte.
            return 'TRUE' if antwort == 'PSL_DATA_USAGE_ONLY_COLLECTED' else 'FALSE'
        if unterfrage == 'PSL_DATA_USAGE_EPHEMERAL':
            # Nein -- die Daten werden gespeichert, nicht nur in der Sitzung.
            return 'FALSE'
        if unterfrage == 'DATA_USAGE_USER_CONTROL':
            # Freiwillig: ohne Konto gibt es nichts davon.
            return 'TRUE' if antwort == 'PSL_DATA_USAGE_USER_CONTROL_OPTIONAL' else 'FALSE'
        if unterfrage == 'DATA_USAGE_COLLECTION_PURPOSE':
            return 'TRUE' if antwort in ERHOBEN[art] else 'FALSE'
        if unterfrage == 'DATA_USAGE_SHARING_PURPOSE':
            # Nichts wird geteilt, also kein Zweck.
            return 'FALSE'
    return None


zeilen = list(csv.DictReader(open(QUELLE, encoding='utf-8')))
felder = list(zeilen[0].keys())
gesetzt = 0
for z in zeilen:
    w = wert(z['Question ID (machine readable)'], z['Response ID (machine readable)'])
    if w is not None:
        z['Response value'] = w
        gesetzt += 1

with open(ZIEL, 'w', encoding='utf-8', newline='') as f:
    s = csv.DictWriter(f, fieldnames=felder)
    s.writeheader()
    s.writerows(zeilen)

print(f'{gesetzt} von {len(zeilen)} Zellen gefüllt, {len(zeilen) - gesetzt} bewusst leer.')
print()
print('=== Alles, was auf TRUE steht ===')
for z in zeilen:
    if z['Response value'] and z['Response value'] != 'FALSE':
        q = z['Question ID (machine readable)'].replace('PSL_DATA_USAGE_RESPONSES:', '')
        print(f"  {q:58} {z['Response ID (machine readable)'] or z['Response value']}")
