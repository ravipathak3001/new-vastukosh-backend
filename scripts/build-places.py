import sys, json, re
src, out = sys.argv[1], sys.argv[2]
DEV = re.compile(r'^[ऀ-ॿ\s.\-]+$')
admin1 = {}
for line in open(f"{src}/admin1CodesASCII.txt", encoding="utf-8"):
    p = line.rstrip("\n").split("\t")
    if len(p) >= 2: admin1[p[0]] = p[1]
countries = {}
for line in open(f"{src}/countryInfo.txt", encoding="utf-8"):
    if line.startswith("#"): continue
    p = line.rstrip("\n").split("\t")
    if len(p) > 4: countries[p[0]] = p[4]
rows, seen, tzs = [], set(), []
def tzi(t):
    if t not in tzs: tzs.append(t)
    return tzs.index(t)
def add(p):
    gid = p[0]
    if gid in seen: return
    seen.add(gid)
    name, ascii_, alts = p[1], p[2], p[3]
    devs = list(dict.fromkeys(a.strip() for a in alts.split(",") if a and DEV.match(a)))
    hi = devs[0] if len(devs) == 1 else ""
    hiSearch = "|".join(devs)
    cc, a1, pop, tz = p[8], p[10], int(p[14] or 0), p[17]
    if not tz: return
    rows.append([name, hi, admin1.get(f"{cc}.{a1}", ""), cc, round(float(p[4]), 4), round(float(p[5]), 4), tzi(tz), pop, ascii_ if ascii_ != name else "", hiSearch])
for line in open(f"{src}/cities5000.txt", encoding="utf-8"):
    p = line.rstrip("\n").split("\t")
    if p[8] == "IN": add(p)
for line in open(f"{src}/cities15000.txt", encoding="utf-8"):
    p = line.rstrip("\n").split("\t")
    if p[8] != "IN" and int(p[14] or 0) >= 100000: add(p)
rows.sort(key=lambda r: -r[7])
json.dump({"source": "GeoNames (geonames.org), CC BY 4.0", "fields": ["name","nameHi","region","country","lat","lng","tz","population","ascii","hiSearch"],
           "timezones": tzs, "countries": {c: countries.get(c, c) for c in sorted({r[3] for r in rows})}, "places": rows},
          open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
india = sum(1 for r in rows if r[3]=="IN"); hi = sum(1 for r in rows if r[1]); hs = sum(1 for r in rows if r[9])
print(len(rows), "places;", india, "in India;", hi, "with a Hindi display name;", hs, "searchable in Devanagari;", len(tzs), "timezones")
