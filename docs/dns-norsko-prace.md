# DNS záznamy norsko-prace.cz

Stav ověřený 12. 11. 2026 veřejným dotazem (Cloudflare DoH).
Zónu hostuje Vercel: ns1.vercel-dns.com, ns2.vercel-dns.com

| Typ | Název | Hodnota | K čemu to je |
|---|---|---|---|
| A | @ | 216.198.79.1 | web na Vercelu |
| A | www | 216.198.79.1, 64.29.17.1 | přesměrování na apex |
| MX | @ | 10 email.webglobe.cz | schránka info@ |
| MX | @ | 10 email2.webglobe.cz | schránka info@ |
| MX | @ | 10 email3.webglobe.cz | schránka info@ |
| MX | @ | 10 email4.webglobe.cz | schránka info@ |
| MX | send | 10 feedback-smtp.eu-west-1.amazonses.com | Resend — zpětná vazba |
| TXT | send | v=spf1 include:amazonses.com ~all | Resend — SPF |
| TXT | resend._domainkey | p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC6uXEV/I1Z587B39UbStai1aCcUeEf0g854ic9Mym28ttU/EzstdDaLO10LijwyzRVcm0w4f5QEbLCYlhaHTRt2VjhmhQmPNf+0JYvSqLquhHcA10IayBmOc37LLO08LHOSdcFS0dsR/WIkks9/IC9MoSU1LcWXqW3ydqImGZihwIDAQAB | Resend — DKIM podpis |
| TXT | _dmarc | v=DMARC1; p=none; | DMARC |
| TXT | @ | google-site-verification=fuYx7Blt0ILPere5RYi-n794_U3NEq1yGZxMHhsv3s0 | Google Search Console |
| TXT | @ | vc-domain-verify=norsko-prace.cz,6dcdf8c3baebfe5be911 | ověření Vercelu (po přesunu se změní) |

## Co chybí

Na apexu není SPF záznam. Pošta odeslaná ze schránky info@ přes Webglobe tím
pádem není SPF ověřená. DMARC je na `p=none`, takže se nic neodmítá, ale
doručitelnost to zhoršuje. Správná hodnota se zjistí u Webglobe — typicky
`v=spf1 include:_spf.webglobe.cz ~all`.

## Pozor při přesunu na jiný Vercel účet

Zóna se mezi účty NEPŘENÁŠÍ. V novém účtu se vytvoří prázdná a všechny
záznamy výše je nutné zadat znovu — do té doby nechodí e-maily.
