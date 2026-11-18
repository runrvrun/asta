// Fictional demo data. Every unit, place, person and registration number is invented.
// Dates are computed relative to the moment the data is seeded so the demo always looks current.
import type {
  Asset, AuditEntry, Category, CategoryId, DB, Disposal, FlightLog, Location, Notification,
  SparePart, StockMovement, StockTake, Transfer, Unit, User, WorkOrder, AviationInfo, Condition, AssetStatus,
} from "./types";

export const DB_VERSION = 1;
export const DEMO_PASSWORD = "asta123";

// ---------- helpers ----------
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const day = 86400000;
function dateOffset(base: number, days: number) {
  return new Date(base + days * day).toISOString().slice(0, 10);
}
function tsOffset(base: number, days: number, hour = 9, minute = 0) {
  const d = new Date(base + days * day);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const CATEGORIES: Category[] = [
  { id: "pesawat", name: "Pesawat Udara", group: "Alutsista Udara", usefulLife: 30, codePrefix: "PSW" },
  { id: "helikopter", name: "Helikopter", group: "Alutsista Udara", usefulLife: 25, codePrefix: "HLI" },
  { id: "nirawak", name: "Pesawat Nirawak (UAV)", group: "Alutsista Udara", usefulLife: 10, codePrefix: "UAV" },
  { id: "radar", name: "Radar & Komunikasi", group: "Peralatan", usefulLife: 15, codePrefix: "RDR" },
  { id: "persenjataan", name: "Persenjataan", group: "Peralatan", usefulLife: 20, codePrefix: "SNJ" },
  { id: "gse", name: "Peralatan Pendukung Darat (GSE)", group: "Peralatan", usefulLife: 10, codePrefix: "GSE" },
  { id: "elektronik", name: "Peralatan Elektronik & TI", group: "Peralatan", usefulLife: 5, codePrefix: "ELK" },
  { id: "kendaraan", name: "Kendaraan", group: "Kendaraan", usefulLife: 10, codePrefix: "KDR" },
  { id: "tanah", name: "Tanah", group: "Properti", usefulLife: 0, codePrefix: "TNH" },
  { id: "bangunan", name: "Gedung & Bangunan", group: "Properti", usefulLife: 40, codePrefix: "BGN" },
  { id: "komponen", name: "Komponen Utama (Rotable)", group: "Komponen", usefulLife: 8, codePrefix: "KMP" },
];

export const AVIATION_CATEGORIES: CategoryId[] = ["pesawat", "helikopter", "nirawak"];

const UNITS: Unit[] = [
  { id: "u-mkp", code: "MKP", name: "Markas Komando Pusat", type: "Komando", city: "Jakarta" },
  { id: "u-pws", code: "PWS", name: "Pangkalan Wirasakti", type: "Pangkalan", city: "Semarang", parentId: "u-mkp" },
  { id: "u-pcb", code: "PCB", name: "Pangkalan Cakrabuana", type: "Pangkalan", city: "Balikpapan", parentId: "u-mkp" },
  { id: "u-s21", code: "SKD-21", name: "Skadron 21 Angkut", type: "Skadron", city: "Semarang", parentId: "u-pws" },
  { id: "u-s07", code: "SKD-07", name: "Skadron 7 Helikopter", type: "Skadron", city: "Balikpapan", parentId: "u-pcb" },
  { id: "u-s33", code: "SKD-33", name: "Skadron 33 Latih", type: "Skadron", city: "Semarang", parentId: "u-pws" },
  { id: "u-s52", code: "SKD-52", name: "Skadron 52 Intai Nirawak", type: "Skadron", city: "Balikpapan", parentId: "u-pcb" },
  { id: "u-d40", code: "DPM-40", name: "Depo Pemeliharaan 40", type: "Depo", city: "Semarang", parentId: "u-mkp" },
  { id: "u-rdr", code: "SRD-12", name: "Satuan Radar 12 Tanjung Laut", type: "Satuan", city: "Kupang", parentId: "u-mkp" },
];

const LOCATIONS: Location[] = [
  { id: "l-mkp-kantor", unitId: "u-mkp", name: "Gedung Mako Utama", kind: "Kantor" },
  { id: "l-mkp-garasi", unitId: "u-mkp", name: "Garasi Kendaraan Dinas", kind: "Garasi" },
  { id: "l-mkp-lahan", unitId: "u-mkp", name: "Kompleks Mako", kind: "Lahan" },
  { id: "l-pws-h1", unitId: "u-pws", name: "Hangar 1", kind: "Hangar" },
  { id: "l-pws-h2", unitId: "u-pws", name: "Hangar 2", kind: "Hangar" },
  { id: "l-pws-apron", unitId: "u-pws", name: "Apron Selatan", kind: "Apron" },
  { id: "l-pws-gudang", unitId: "u-pws", name: "Gudang Logistik A", kind: "Gudang" },
  { id: "l-pws-garasi", unitId: "u-pws", name: "Garasi Satuan Angkutan", kind: "Garasi" },
  { id: "l-pws-lahan", unitId: "u-pws", name: "Lahan Pangkalan", kind: "Lahan" },
  { id: "l-pws-senjata", unitId: "u-pws", name: "Gudang Persenjataan", kind: "Gudang" },
  { id: "l-pcb-h1", unitId: "u-pcb", name: "Hangar Helikopter", kind: "Hangar" },
  { id: "l-pcb-apron", unitId: "u-pcb", name: "Apron Utara", kind: "Apron" },
  { id: "l-pcb-gudang", unitId: "u-pcb", name: "Gudang Logistik B", kind: "Gudang" },
  { id: "l-pcb-lahan", unitId: "u-pcb", name: "Lahan Pangkalan", kind: "Lahan" },
  { id: "l-pcb-garasi", unitId: "u-pcb", name: "Garasi PKP-PK", kind: "Garasi" },
  { id: "l-d40-bengkel", unitId: "u-d40", name: "Bengkel Mesin", kind: "Bengkel" },
  { id: "l-d40-gudang", unitId: "u-d40", name: "Gudang Suku Cadang Pusat", kind: "Gudang" },
  { id: "l-d40-hangar", unitId: "u-d40", name: "Hangar Overhaul", kind: "Hangar" },
  { id: "l-rdr-site", unitId: "u-rdr", name: "Site Radar Bukit Timur", kind: "Lainnya" },
  { id: "l-rdr-kantor", unitId: "u-rdr", name: "Ruang Operasi", kind: "Kantor" },
];

function makeUsers(now: number): User[] {
  const u = (id: string, username: string, name: string, rank: string, nrp: string, position: string, role: User["role"], unitId: string, active = true, lastLoginDaysAgo?: number): User => ({
    id, username, password: DEMO_PASSWORD, name, rank, nrp, position, role, unitId, active,
    lastLogin: lastLoginDaysAgo === undefined ? undefined : tsOffset(now, -lastLoginDaysAgo, 8, 15),
  });
  return [
    u("usr-admin", "admin", "Dimas Prakoso", "Mayor", "512308", "Kasubsi Sistem Informasi Aset", "admin", "u-mkp", true, 1),
    u("usr-pimpinan", "komandan", "Hendra Wijayakusuma", "Kolonel", "507711", "Komandan Pangkalan Wirasakti", "pimpinan", "u-pws", true, 2),
    u("usr-petugas", "petugas", "Sari Anggraini", "Kapten", "521904", "Perwira Pengelola Aset", "petugas", "u-pws", true, 0),
    u("usr-teknisi", "teknisi", "Andi Prasetyo", "Serma", "689012", "Teknisi Pesawat Angkut", "teknisi", "u-d40", true, 0),
    u("usr-auditor", "auditor", "Ratna Pertiwi", "Letkol", "509837", "Inspektur Logistik", "auditor", "u-mkp", true, 5),
    u("usr-pimpinan2", "kadepo", "Agus Setiadi", "Letkol", "510244", "Kepala Depo Pemeliharaan 40", "pimpinan", "u-d40", true, 3),
    u("usr-petugas2", "petugas2", "Fajar Nugroho", "Lettu", "530118", "Perwira Logistik Pangkalan", "petugas", "u-pcb", true, 4),
    u("usr-teknisi2", "budi", "Budi Santoso", "Sertu", "701556", "Teknisi Helikopter", "teknisi", "u-s07", true, 1),
    u("usr-teknisi3", "citra", "Citra Ramadhani", "Peltu", "655230", "Teknisi Kelistrikan & Avionik", "teknisi", "u-d40", true, 2),
    u("usr-teknisi4", "dedi", "Dedi Kurniawan", "Serka", "688417", "Teknisi Mesin", "teknisi", "u-d40", true, 6),
    u("usr-petugas3", "wulan", "Wulan Maharani", "PNS III/c", "198804122010", "Pengelola Barang Milik Negara", "petugas", "u-mkp", false, 60),
  ];
}

// ---------- assets ----------
type AssetSeed = {
  cat: CategoryId; name: string; brand: string; model: string; reg?: string; year: number;
  value: number; unit: string; loc: string; pic: string; cond?: Condition; status?: AssetStatus;
  specs?: Record<string, string>; av?: Partial<AviationInfo> & { fh: number; aw?: AviationInfo["airworthiness"] };
  funding?: Asset["fundingSource"];
};

const B = 1_000_000_000;

const ASSET_SEEDS: AssetSeed[] = [
  // Pesawat
  { cat: "pesawat", name: "Pesawat Angkut Berat AX-1301", brand: "Lockheed Martin", model: "C-130H Hercules", reg: "AX-1301", year: 1989, value: 420 * B, unit: "u-s21", loc: "l-pws-h1", pic: "usr-teknisi", av: { fh: 18420, aw: "Laik", engine: "4× Allison T56-A-15" }, funding: "Kredit Ekspor" },
  { cat: "pesawat", name: "Pesawat Angkut Berat AX-1307", brand: "Lockheed Martin", model: "C-130H Hercules", reg: "AX-1307", year: 1991, value: 435 * B, unit: "u-s21", loc: "l-pws-h1", pic: "usr-teknisi", status: "Dalam Pemeliharaan", av: { fh: 17260, aw: "Tidak Laik", engine: "4× Allison T56-A-15" }, funding: "Kredit Ekspor" },
  { cat: "pesawat", name: "Pesawat Angkut Berat AX-1342", brand: "Lockheed Martin", model: "C-130J-30 Super Hercules", reg: "AX-1342", year: 2023, value: 1_350 * B, unit: "u-s21", loc: "l-pws-apron", pic: "usr-teknisi", av: { fh: 1240, aw: "Laik", engine: "4× Rolls-Royce AE 2100D3" } },
  { cat: "pesawat", name: "Pesawat Angkut Sedang AX-2903", brand: "Airbus", model: "C295", reg: "AX-2903", year: 2014, value: 610 * B, unit: "u-s21", loc: "l-pws-h2", pic: "usr-teknisi", av: { fh: 7810, aw: "Laik", engine: "2× PW127G" } },
  { cat: "pesawat", name: "Pesawat Angkut Sedang AX-2905", brand: "Airbus", model: "C295", reg: "AX-2905", year: 2015, value: 615 * B, unit: "u-s21", loc: "l-pws-h2", pic: "usr-teknisi", av: { fh: 7190, aw: "Laik Terbatas", engine: "2× PW127G" } },
  { cat: "pesawat", name: "Pesawat Patroli Maritim AX-2311", brand: "PT Dirgantara Indonesia", model: "CN235-220 MPA", reg: "AX-2311", year: 2008, value: 380 * B, unit: "u-s21", loc: "l-pws-h2", pic: "usr-teknisi", av: { fh: 11860, aw: "Laik", engine: "2× GE CT7-9C" } },
  { cat: "pesawat", name: "Pesawat Latih Dasar LX-0114", brand: "Grob Aircraft", model: "G 120TP", reg: "LX-0114", year: 2017, value: 48 * B, unit: "u-s33", loc: "l-pws-h1", pic: "usr-teknisi", av: { fh: 4320, aw: "Laik", engine: "1× RR M250-B17F" } },
  { cat: "pesawat", name: "Pesawat Latih Dasar LX-0117", brand: "Grob Aircraft", model: "G 120TP", reg: "LX-0117", year: 2017, value: 48 * B, unit: "u-s33", loc: "l-pws-h1", pic: "usr-teknisi", cond: "Rusak Ringan", av: { fh: 4570, aw: "Laik Terbatas", engine: "1× RR M250-B17F" } },
  { cat: "pesawat", name: "Pesawat Latih Lanjut LX-1108", brand: "KAI", model: "KT-1B Wong Bee", reg: "LX-1108", year: 2005, value: 95 * B, unit: "u-s33", loc: "l-pws-h1", pic: "usr-teknisi", av: { fh: 6980, aw: "Laik", engine: "1× PT6A-62" } },
  { cat: "pesawat", name: "Pesawat Latih Lanjut LX-1102", brand: "KAI", model: "KT-1B Wong Bee", reg: "LX-1102", year: 2004, value: 92 * B, unit: "u-s33", loc: "l-pws-h1", pic: "usr-teknisi", cond: "Rusak Berat", status: "Diusulkan Hapus", av: { fh: 8910, aw: "Tidak Laik", engine: "1× PT6A-62" } },
  // Helikopter
  { cat: "helikopter", name: "Helikopter Angkut Berat HX-7201", brand: "Airbus Helicopters", model: "H225M Caracal", reg: "HX-7201", year: 2021, value: 780 * B, unit: "u-s07", loc: "l-pcb-h1", pic: "usr-teknisi2", av: { fh: 1650, aw: "Laik", engine: "2× Makila 2A1" } },
  { cat: "helikopter", name: "Helikopter Angkut Berat HX-7202", brand: "Airbus Helicopters", model: "H225M Caracal", reg: "HX-7202", year: 2021, value: 780 * B, unit: "u-s07", loc: "l-pcb-h1", pic: "usr-teknisi2", av: { fh: 1590, aw: "Laik", engine: "2× Makila 2A1" } },
  { cat: "helikopter", name: "Helikopter Angkut Sedang HX-3204", brand: "Airbus Helicopters", model: "AS332 L1 Super Puma", reg: "HX-3204", year: 2002, value: 210 * B, unit: "u-s07", loc: "l-pcb-h1", pic: "usr-teknisi2", status: "Dalam Pemeliharaan", av: { fh: 9240, aw: "Tidak Laik", engine: "2× Makila 1A1" } },
  { cat: "helikopter", name: "Helikopter Latih HX-1201", brand: "Airbus Helicopters", model: "EC120B Colibri", reg: "HX-1201", year: 2012, value: 32 * B, unit: "u-s07", loc: "l-pcb-h1", pic: "usr-teknisi2", av: { fh: 5120, aw: "Laik", engine: "1× Arrius 2F" } },
  { cat: "helikopter", name: "Helikopter Serbaguna HX-4105", brand: "Bell Textron", model: "Bell 412EPI", reg: "HX-4105", year: 2019, value: 145 * B, unit: "u-s07", loc: "l-pcb-apron", pic: "usr-teknisi2", av: { fh: 2260, aw: "Laik", engine: "2× PT6T-9" } },
  // Nirawak
  { cat: "nirawak", name: "Pesawat Nirawak MALE NX-5201", brand: "Rajawali Aerosystems", model: "RX-200 MALE", reg: "NX-5201", year: 2022, value: 145 * B, unit: "u-s52", loc: "l-pcb-h1", pic: "usr-teknisi3", av: { fh: 1880, aw: "Laik", engine: "1× Rotax 914" } },
  { cat: "nirawak", name: "Pesawat Nirawak MALE NX-5202", brand: "Rajawali Aerosystems", model: "RX-200 MALE", reg: "NX-5202", year: 2022, value: 145 * B, unit: "u-s52", loc: "l-pcb-h1", pic: "usr-teknisi3", av: { fh: 1730, aw: "Laik Terbatas", engine: "1× Rotax 914" } },
  { cat: "nirawak", name: "UAV Taktis NX-1510", brand: "Insitu", model: "ScanEagle 3", reg: "NX-1510", year: 2020, value: 12 * B, unit: "u-s52", loc: "l-pcb-gudang", pic: "usr-teknisi3", av: { fh: 940, aw: "Laik", engine: "1× piston 2-tak" } },
  // Radar & komunikasi
  { cat: "radar", name: "Radar Pertahanan Udara Jarak Jauh", brand: "Thales", model: "GM403", year: 2018, value: 520 * B, unit: "u-rdr", loc: "l-rdr-site", pic: "usr-teknisi3", specs: { "Jangkauan": "470 km", "Frekuensi": "S-band" } },
  { cat: "radar", name: "Radar Cuaca Pangkalan", brand: "Vaisala", model: "WRM200", year: 2016, value: 28 * B, unit: "u-pws", loc: "l-pws-lahan", pic: "usr-teknisi3", cond: "Rusak Ringan", specs: { "Jangkauan": "250 km", "Frekuensi": "C-band" } },
  { cat: "radar", name: "Radio HF Pangkalan", brand: "Harris", model: "RF-7800H", year: 2019, value: 1.8 * B, unit: "u-pws", loc: "l-pws-lahan", pic: "usr-teknisi3", specs: { "Daya": "400 W" } },
  { cat: "radar", name: "Sistem Navigasi TACAN", brand: "Thales", model: "TACAN 453", year: 2013, value: 14 * B, unit: "u-pcb", loc: "l-pcb-lahan", pic: "usr-teknisi3", specs: { "Kanal": "126X/126Y" } },
  // Persenjataan
  { cat: "persenjataan", name: "Sistem Hanud Titik 35 mm (1 baterai)", brand: "Rheinmetall", model: "Skyshield 35", year: 2015, value: 410 * B, unit: "u-pws", loc: "l-pws-lahan", pic: "usr-petugas", specs: { "Komposisi": "2 meriam, 1 sensor, 1 pos komando" } },
  { cat: "persenjataan", name: "Senapan Serbu 5,56 mm (lot 120 pucuk)", brand: "PT Pindad", model: "SS2-V1", year: 2020, value: 2.4 * B, unit: "u-pws", loc: "l-pws-senjata", pic: "usr-petugas", specs: { "Jumlah": "120 pucuk" } },
  { cat: "persenjataan", name: "Pod Senjata Roket 70 mm (4 unit)", brand: "Thales", model: "FZ225", year: 2019, value: 9.6 * B, unit: "u-s07", loc: "l-pcb-gudang", pic: "usr-teknisi2", specs: { "Jumlah": "4 unit" } },
  // GSE
  { cat: "gse", name: "Ground Power Unit GPU-04", brand: "Hobart", model: "JetEx 5D", year: 2018, value: 1.9 * B, unit: "u-pws", loc: "l-pws-apron", pic: "usr-teknisi", status: "Dalam Pemeliharaan", cond: "Rusak Ringan", specs: { "Output": "90 kVA" } },
  { cat: "gse", name: "Traktor Penarik Pesawat TT-02", brand: "TLD", model: "TMX-150", year: 2016, value: 3.2 * B, unit: "u-pws", loc: "l-pws-apron", pic: "usr-teknisi", specs: { "Kapasitas tarik": "150 ton" } },
  { cat: "gse", name: "Hydraulic Ground Cart HC-01", brand: "Tronair", model: "5MD06", year: 2017, value: 0.85 * B, unit: "u-d40", loc: "l-d40-hangar", pic: "usr-teknisi4", specs: { "Tekanan": "3000 psi" } },
  { cat: "gse", name: "Nitrogen Cart NC-03", brand: "Tronair", model: "11-5502", year: 2014, value: 0.32 * B, unit: "u-pcb", loc: "l-pcb-apron", pic: "usr-teknisi2", cond: "Rusak Berat", status: "Diusulkan Hapus" },
  { cat: "gse", name: "Forklift Kargo FL-02", brand: "Toyota", model: "8FD50N", year: 2013, value: 0.62 * B, unit: "u-pws", loc: "l-pws-gudang", pic: "usr-petugas", specs: { "Kapasitas": "5 ton" } },
  // Kendaraan
  { cat: "kendaraan", name: "Truk Pengisi Bahan Bakar Avtur", brand: "Mercedes-Benz", model: "Axor 2528 Refueller", year: 2019, value: 3.6 * B, unit: "u-pws", loc: "l-pws-garasi", pic: "usr-petugas", specs: { "No. Polisi": "12-XIV", "Kapasitas": "16.000 L", "Odometer": "48.210 km" } },
  { cat: "kendaraan", name: "Kendaraan Pemadam (Crash Tender)", brand: "Rosenbauer", model: "Panther 6x6", year: 2021, value: 14.5 * B, unit: "u-pcb", loc: "l-pcb-garasi", pic: "usr-petugas2", specs: { "No. Polisi": "07-XIV", "Kapasitas air": "12.500 L", "Odometer": "6.870 km" } },
  { cat: "kendaraan", name: "Truk Angkut Personel", brand: "Hino", model: "Ranger FM 260 JD", year: 2017, value: 1.1 * B, unit: "u-pws", loc: "l-pws-garasi", pic: "usr-petugas", specs: { "No. Polisi": "31-XIV", "Odometer": "112.400 km" } },
  { cat: "kendaraan", name: "Ambulans Pangkalan", brand: "Toyota", model: "HiAce Ambulance", year: 2020, value: 0.95 * B, unit: "u-pws", loc: "l-pws-garasi", pic: "usr-petugas", status: "Dipinjam", specs: { "No. Polisi": "45-XIV", "Odometer": "38.900 km" } },
  { cat: "kendaraan", name: "Kendaraan Dinas Operasional", brand: "Toyota", model: "Hilux 2.4 D-Cab 4x4", year: 2022, value: 0.62 * B, unit: "u-mkp", loc: "l-mkp-garasi", pic: "usr-admin", specs: { "No. Polisi": "03-XI", "Odometer": "21.300 km" } },
  { cat: "kendaraan", name: "Bus Personel 30 Kursi", brand: "Isuzu", model: "Elf NLR 55 BLX", year: 2011, value: 0.48 * B, unit: "u-pcb", loc: "l-pcb-garasi", pic: "usr-petugas2", cond: "Rusak Berat", status: "Diusulkan Hapus", specs: { "No. Polisi": "19-XIV", "Odometer": "286.000 km" } },
  // Elektronik
  { cat: "elektronik", name: "Simulator Kokpit Latih", brand: "ELITE Simulation", model: "S812 FNPT II", year: 2018, value: 7.8 * B, unit: "u-s33", loc: "l-pws-h1", pic: "usr-teknisi3" },
  { cat: "elektronik", name: "Server Pusat Data Logistik", brand: "Dell", model: "PowerEdge R760", year: 2024, value: 0.68 * B, unit: "u-mkp", loc: "l-mkp-kantor", pic: "usr-admin", specs: { "CPU": "2× Xeon Gold", "RAM": "512 GB" } },
  { cat: "elektronik", name: "Perangkat Uji Avionik", brand: "Viavi", model: "IFR 6015", year: 2019, value: 1.25 * B, unit: "u-d40", loc: "l-d40-bengkel", pic: "usr-teknisi3" },
  // Tanah
  { cat: "tanah", name: "Tanah Pangkalan Wirasakti", brand: "-", model: "-", reg: "SHP No. 00412", year: 1958, value: 1_850 * B, unit: "u-pws", loc: "l-pws-lahan", pic: "usr-petugas", funding: "Lainnya", specs: { "Luas": "4.120.000 m²", "Status hak": "Hak Pakai", "Alamat": "Jl. Angkasa Raya, Semarang" } },
  { cat: "tanah", name: "Tanah Pangkalan Cakrabuana", brand: "-", model: "-", reg: "SHP No. 00977", year: 1971, value: 960 * B, unit: "u-pcb", loc: "l-pcb-lahan", pic: "usr-petugas2", funding: "Lainnya", specs: { "Luas": "2.380.000 m²", "Status hak": "Hak Pakai", "Alamat": "Jl. Cakrawala, Balikpapan" } },
  { cat: "tanah", name: "Tanah Perumahan Dinas Blok C", brand: "-", model: "-", reg: "SHP No. 01135", year: 1985, value: 74 * B, unit: "u-mkp", loc: "l-mkp-lahan", pic: "usr-admin", funding: "Lainnya", specs: { "Luas": "38.500 m²", "Status hak": "Hak Pakai", "Alamat": "Jl. Merpati Blok C, Jakarta" } },
  // Bangunan
  { cat: "bangunan", name: "Hangar Pemeliharaan Pesawat Angkut", brand: "-", model: "Konstruksi baja bentang lebar", year: 2009, value: 86 * B, unit: "u-pws", loc: "l-pws-h1", pic: "usr-petugas", specs: { "Luas bangunan": "6.400 m²", "Jumlah lantai": "1" } },
  { cat: "bangunan", name: "Menara Pengawas Lalu Lintas Udara", brand: "-", model: "Beton bertulang", year: 2012, value: 42 * B, unit: "u-pws", loc: "l-pws-lahan", pic: "usr-petugas", specs: { "Luas bangunan": "980 m²", "Jumlah lantai": "7" } },
  { cat: "bangunan", name: "Gedung Markas Komando", brand: "-", model: "Beton bertulang", year: 1998, value: 120 * B, unit: "u-mkp", loc: "l-mkp-kantor", pic: "usr-admin", cond: "Rusak Ringan", specs: { "Luas bangunan": "12.600 m²", "Jumlah lantai": "5" } },
  { cat: "bangunan", name: "Hangar Helikopter", brand: "-", model: "Konstruksi baja", year: 2016, value: 54 * B, unit: "u-pcb", loc: "l-pcb-h1", pic: "usr-petugas2", specs: { "Luas bangunan": "3.200 m²", "Jumlah lantai": "1" } },
  { cat: "bangunan", name: "Mess Perwira Bujangan", brand: "-", model: "Beton bertulang", year: 1994, value: 18 * B, unit: "u-pcb", loc: "l-pcb-lahan", pic: "usr-petugas2", cond: "Rusak Ringan", specs: { "Luas bangunan": "2.150 m²", "Jumlah lantai": "3", "Kapasitas": "64 kamar" } },
  // Komponen rotable
  { cat: "komponen", name: "APU Starter Generator", brand: "Honeywell", model: "GTCP85 SG", year: 2021, value: 2.1 * B, unit: "u-d40", loc: "l-d40-bengkel", pic: "usr-teknisi", status: "Dalam Pemeliharaan", cond: "Rusak Ringan", specs: { "P/N": "23078-016", "TSO": "2.140 jam" } },
  { cat: "komponen", name: "Mesin Turboprop Cadangan T56", brand: "Rolls-Royce", model: "T56-A-15LFE", year: 2019, value: 38 * B, unit: "u-d40", loc: "l-d40-gudang", pic: "usr-teknisi4", specs: { "P/N": "T56-15LFE", "TSO": "0 jam (pasca-overhaul)" } },
  { cat: "komponen", name: "Main Rotor Gearbox Cadangan", brand: "Safran", model: "MGB AS332", year: 2018, value: 16 * B, unit: "u-d40", loc: "l-d40-gudang", pic: "usr-teknisi4", specs: { "P/N": "332A32-5001", "TSO": "1.020 jam" } },
  { cat: "komponen", name: "Propeller Assembly 4 Bilah", brand: "Hamilton Sundstrand", model: "54H60-91", year: 2016, value: 4.4 * B, unit: "u-d40", loc: "l-d40-gudang", pic: "usr-teknisi4", specs: { "P/N": "54H60-91", "TSO": "3.880 jam" } },
];

function makeAssets(now: number): Asset[] {
  const r = rng(42);
  const counters: Record<string, number> = {};
  return ASSET_SEEDS.map((s, i) => {
    const cat = CATEGORIES.find((c) => c.id === s.cat)!;
    counters[cat.codePrefix] = (counters[cat.codePrefix] ?? 0) + 1;
    const code = `${cat.codePrefix}-${s.year}-${String(counters[cat.codePrefix]).padStart(4, "0")}`;
    const acqMonth = String(1 + Math.floor(r() * 12)).padStart(2, "0");
    const acqDay = String(1 + Math.floor(r() * 27)).padStart(2, "0");
    const av = s.av;
    let aviation: AviationInfo | undefined;
    if (av) {
      const interval = s.cat === "pesawat" ? (s.model.includes("C-130") ? 200 : 150) : s.cat === "helikopter" ? 100 : 50;
      // Spread "hours since last inspection" so some aircraft are due soon or overdue.
      const since = [0.15, 0.55, 0.92, 1.04, 0.35, 0.78, 0.6, 0.97, 0.25, 0.4][i % 10] * interval;
      const certDays = [210, 45, 330, 18, 160, -6, 400, 75, 25, 120][i % 10];
      aviation = {
        airworthiness: av.aw ?? "Laik",
        flightHours: av.fh,
        cycles: Math.round(av.fh * (s.cat === "helikopter" ? 1.6 : 0.7)),
        inspectionIntervalHours: interval,
        lastInspectionHours: Math.round(av.fh - since),
        lastInspectionDate: dateOffset(now, -Math.round(30 + r() * 120)),
        certificateNo: `SKL/${s.reg}/${2024 + (i % 3)}`,
        certificateExpiry: dateOffset(now, certDays),
        engine: av.engine ?? "-",
      };
    }
    const created = tsOffset(now, -400 + i * 3, 10);
    return {
      id: `ast-${String(i + 1).padStart(3, "0")}`,
      code,
      name: s.name,
      categoryId: s.cat,
      brand: s.brand,
      model: s.model,
      serialNumber: s.cat === "tanah" || s.cat === "bangunan" ? "-" : `SN-${Math.floor(100000 + r() * 899999)}`,
      registration: s.reg,
      year: s.year,
      acquisitionDate: `${s.year}-${acqMonth}-${acqDay}`,
      acquisitionValue: Math.round(s.value),
      fundingSource: s.funding ?? (r() > 0.85 ? "Hibah" : "APBN"),
      usefulLife: cat.usefulLife,
      residualValue: cat.usefulLife === 0 ? Math.round(s.value) : Math.round(s.value * 0.05),
      unitId: s.unit,
      locationId: s.loc,
      picId: s.pic,
      condition: s.cond ?? "Baik",
      status: s.status ?? "Aktif",
      specs: s.specs ?? {},
      aviation,
      documents: [
        { id: `doc-${i}-1`, name: s.cat === "tanah" ? "Sertifikat Hak Pakai.pdf" : "Berita Acara Serah Terima.pdf", size: 820_000 + Math.floor(r() * 900_000), uploadedAt: created, uploadedBy: "usr-petugas" },
        ...(av ? [{ id: `doc-${i}-2`, name: "Sertifikat Kelaikan Udara.pdf", size: 410_000, uploadedAt: created, uploadedBy: "usr-teknisi" }] : []),
      ],
      createdAt: created,
      updatedAt: created,
    };
  });
}

function makeSpareParts(): SparePart[] {
  const p = (id: string, partNumber: string, name: string, category: SparePart["category"], uom: string, stock: number, minStock: number, price: number, locationId: string, compatible: string): SparePart =>
    ({ id, partNumber, name, category, uom, stock, minStock, price, locationId, compatible });
  return [
    p("prt-01", "BRG-4471", "Bearing Set Starter Generator", "Kelistrikan", "set", 1, 3, 18_500_000, "l-d40-gudang", "APU GTCP85"),
    p("prt-02", "SK-220", "Seal Kit Starter Generator", "Kelistrikan", "set", 6, 4, 4_200_000, "l-d40-gudang", "APU GTCP85"),
    p("prt-03", "MIL-G-81322", "Grease Aviasi", "Consumable", "kg", 14, 10, 1_150_000, "l-d40-gudang", "Umum"),
    p("prt-04", "MIL-PRF-5606", "Fluida Hidrolik", "Hidrolik", "liter", 85, 120, 310_000, "l-d40-gudang", "Pesawat angkut, GSE"),
    p("prt-05", "T56-FN-118", "Fuel Nozzle T56", "Mesin", "pcs", 4, 8, 46_000_000, "l-d40-gudang", "C-130H"),
    p("prt-06", "PW127-IGN", "Igniter Plug PW127", "Mesin", "pcs", 10, 6, 7_800_000, "l-d40-gudang", "C295"),
    p("prt-07", "CT7-OF-22", "Oil Filter Element CT7", "Mesin", "pcs", 18, 12, 2_650_000, "l-d40-gudang", "CN235"),
    p("prt-08", "MLG-TIRE-40", "Ban Roda Pendarat Utama 40×14", "Roda & Rem", "pcs", 6, 8, 38_000_000, "l-pws-gudang", "C-130H"),
    p("prt-09", "BRK-ASY-130", "Brake Assembly Roda Utama", "Roda & Rem", "set", 2, 2, 165_000_000, "l-pws-gudang", "C-130H"),
    p("prt-10", "AVN-VHF-22", "Transceiver VHF Komunikasi", "Avionik", "unit", 3, 2, 92_000_000, "l-d40-gudang", "Umum"),
    p("prt-11", "AVN-GPS-530", "Modul GPS/NAV", "Avionik", "unit", 1, 2, 148_000_000, "l-d40-gudang", "G 120TP, KT-1B"),
    p("prt-12", "TR-BLADE-332", "Tail Rotor Blade", "Struktur", "pcs", 4, 4, 210_000_000, "l-pcb-gudang", "AS332"),
    p("prt-13", "MR-DAMP-225", "Damper Rotor Utama", "Struktur", "pcs", 6, 4, 64_000_000, "l-pcb-gudang", "H225M"),
    p("prt-14", "BAT-NICD-24", "Baterai NiCd 24V 40Ah", "Kelistrikan", "unit", 5, 4, 41_000_000, "l-d40-gudang", "Umum"),
    p("prt-15", "OIL-TURB-254", "Oli Mesin Turbin Tipe II", "Consumable", "liter", 240, 200, 420_000, "l-d40-gudang", "Mesin turbin"),
    p("prt-16", "FLT-AIR-HINO", "Filter Udara Truk", "Kendaraan", "pcs", 9, 6, 650_000, "l-pws-gudang", "Hino Ranger"),
    p("prt-17", "TIRE-1100R20", "Ban Truk 11.00R20", "Kendaraan", "pcs", 3, 6, 4_900_000, "l-pws-gudang", "Truk, refueller"),
    p("prt-18", "GPU-REL-90", "Contactor Relay GPU", "Kelistrikan", "pcs", 0, 2, 12_400_000, "l-d40-gudang", "Hobart JetEx"),
    p("prt-19", "UAV-PROP-914", "Propeller Komposit UAV", "Struktur", "pcs", 8, 4, 22_000_000, "l-pcb-gudang", "RX-200"),
    p("prt-20", "SEAL-HYD-KIT", "Seal Kit Aktuator Hidrolik", "Hidrolik", "set", 7, 5, 8_700_000, "l-d40-gudang", "Umum"),
  ];
}

function makeWorkOrders(now: number): WorkOrder[] {
  const wo = (i: number, assetId: string, type: WorkOrder["type"], title: string, description: string, priority: WorkOrder["priority"], status: WorkOrder["status"], assigneeId: string | undefined, createdDaysAgo: number, dueInDays: number, estHours: number, actualHours: number, checklist: [string, boolean][], parts: WorkOrder["parts"], timeline: [number, string, string][]): WorkOrder => {
    const created = tsOffset(now, -createdDaysAgo, 8, 10);
    const month = new Date(created).toISOString().slice(0, 7).replace("-", "-");
    return {
      id: `wo-${String(i).padStart(3, "0")}`,
      no: `WO-${month}-${String(400 + i).padStart(4, "0")}`,
      assetId, type, title, description, priority, status, assigneeId,
      createdBy: "usr-petugas",
      createdAt: created,
      dueDate: dateOffset(now, dueInDays),
      completedAt: status === "selesai" ? tsOffset(now, Math.min(dueInDays, -1), 15, 30) : undefined,
      estHours, actualHours,
      checklist: checklist.map(([text, done], k) => ({ id: `ck-${i}-${k}`, text, done })),
      parts,
      timeline: timeline.map(([d, text, by]) => ({ at: tsOffset(now, -d, 9, 30), text, by })),
    };
  };
  return [
    wo(1, "ast-048", "Korektif", "Penggantian bearing starter generator APU", "Starter generator APU bergetar berlebih saat start-up. Indikasi keausan pada bearing utama, ditemukan saat inspeksi rutin oleh tim Hangar 1.", "Tinggi", "dikerjakan", "usr-teknisi", 9, 4, 8, 5.5,
      [["Lepas unit starter generator dari dudukan", true], ["Bongkar housing & periksa bearing", true], ["Ganti bearing dengan part baru (BRG-4471)", false], ["Pasang kembali & uji fungsi", false], ["Verifikasi getaran dalam batas normal", false]],
      [{ partId: "prt-02", qty: 1 }, { partId: "prt-03", qty: 1 }],
      [[9, "WO dibuat", "usr-petugas"], [9, "Ditugaskan ke Serma Andi Prasetyo", "usr-petugas"], [8, "Mulai dikerjakan", "usr-teknisi"], [7, "Menunggu kedatangan bearing BRG-4471", "usr-teknisi"], [3, "Part diterima, pekerjaan dilanjutkan", "usr-teknisi"]]),
    wo(2, "ast-002", "Inspeksi Berkala", "Inspeksi periodik 200 jam AX-1307", "Inspeksi periodik terjadwal setelah pesawat melewati batas 200 jam terbang. Termasuk pemeriksaan struktur sayap dan roda pendarat.", "Kritis", "menunggu_part", "usr-teknisi4", 14, 2, 64, 41,
      [["Pemeriksaan visual struktur & sayap", true], ["Borescope mesin no. 1–4", true], ["Penggantian fuel nozzle mesin no. 2", false], ["Pemeriksaan & servis roda pendarat", true], ["Uji fungsi sistem hidrolik", false], ["Ground run & uji terbang", false]],
      [{ partId: "prt-04", qty: 20 }, { partId: "prt-15", qty: 24 }],
      [[14, "WO dibuat dari jadwal inspeksi", "usr-petugas"], [14, "Ditugaskan ke Serka Dedi Kurniawan", "usr-petugas"], [13, "Mulai dikerjakan", "usr-teknisi4"], [6, "Menunggu fuel nozzle T56-FN-118 (stok kurang)", "usr-teknisi4"]]),
    wo(3, "ast-026", "Korektif", "Perbaikan kelistrikan GPU-04", "Output tegangan GPU tidak stabil, contactor relay terbakar.", "Tinggi", "menunggu_part", "usr-teknisi3", 11, -1, 6, 3,
      [["Diagnosa sistem kelistrikan", true], ["Ganti contactor relay", false], ["Uji beban 90 kVA", false]],
      [],
      [[11, "WO dibuat", "usr-petugas"], [10, "Mulai dikerjakan", "usr-teknisi3"], [9, "Menunggu contactor relay GPU-REL-90", "usr-teknisi3"]]),
    wo(4, "ast-013", "Korektif", "Overhaul gearbox rotor utama HX-3204", "Chip detector gearbox rotor utama menyala saat terbang latihan. Helikopter di-grounded.", "Kritis", "dikerjakan", "usr-teknisi2", 20, 10, 120, 76,
      [["Lepas gearbox rotor utama", true], ["Kirim ke Depo untuk overhaul", true], ["Pasang gearbox cadangan", false], ["Track & balance rotor", false], ["Uji terbang", false]],
      [{ partId: "prt-15", qty: 18 }],
      [[20, "WO dibuat", "usr-petugas2"], [19, "Ditugaskan ke Sertu Budi Santoso", "usr-petugas2"], [18, "Mulai dikerjakan", "usr-teknisi2"]]),
    wo(5, "ast-003", "Preventif", "Servis 150 jam C-130J AX-1342", "Servis preventif terjadwal sesuai manual perawatan pabrikan.", "Sedang", "baru", undefined, 2, 12, 24, 0,
      [["Penggantian filter oli mesin", false], ["Pelumasan titik-titik kontrol", false], ["Pemeriksaan ban & rem", false]], [], [[2, "WO dibuat", "usr-petugas"]]),
    wo(6, "ast-008", "Korektif", "Perbaikan modul GPS LX-0117", "Modul GPS/NAV kehilangan sinyal berulang saat navigasi lintas medan.", "Sedang", "baru", "usr-teknisi3", 3, 7, 6, 0,
      [["Uji fungsi modul GPS", false], ["Ganti modul bila perlu", false], ["Uji darat & kalibrasi", false]], [], [[3, "WO dibuat", "usr-petugas"], [2, "Ditugaskan ke Peltu Citra Ramadhani", "usr-petugas"]]),
    wo(7, "ast-005", "Inspeksi Berkala", "Inspeksi 150 jam C295 AX-2905", "Inspeksi berkala, termasuk pemeriksaan retak pada flap kanan yang dilaporkan pilot.", "Tinggi", "dikerjakan", "usr-teknisi", 6, 5, 40, 18,
      [["Inspeksi flap kanan (NDT)", true], ["Penggantian igniter plug", false], ["Pemeriksaan avionik", false]],
      [{ partId: "prt-06", qty: 2 }],
      [[6, "WO dibuat", "usr-petugas"], [5, "Mulai dikerjakan", "usr-teknisi"]]),
    wo(8, "ast-020", "Korektif", "Perbaikan antena radar cuaca", "Rotasi antena tersendat, suara abnormal dari motor penggerak.", "Sedang", "dikerjakan", "usr-teknisi3", 12, 3, 16, 9,
      [["Pemeriksaan motor penggerak", true], ["Penggantian bearing antena", false]], [], [[12, "WO dibuat", "usr-petugas"], [10, "Mulai dikerjakan", "usr-teknisi3"]]),
    wo(9, "ast-033", "Preventif", "Servis 10.000 km truk angkut personel", "Servis berkala kendaraan.", "Rendah", "selesai", "usr-teknisi4", 25, -18, 4, 3.5,
      [["Ganti oli & filter", true], ["Ganti filter udara", true], ["Periksa rem", true]],
      [{ partId: "prt-16", qty: 1 }],
      [[25, "WO dibuat", "usr-petugas"], [23, "Mulai dikerjakan", "usr-teknisi4"], [19, "Selesai dikerjakan", "usr-teknisi4"]]),
    wo(10, "ast-011", "Preventif", "Servis 100 jam H225M HX-7201", "Servis preventif.", "Sedang", "selesai", "usr-teknisi2", 40, -30, 18, 16,
      [["Pemeriksaan damper rotor", true], ["Pelumasan swashplate", true], ["Uji fungsi autopilot", true]],
      [{ partId: "prt-13", qty: 2 }],
      [[40, "WO dibuat", "usr-petugas2"], [38, "Mulai dikerjakan", "usr-teknisi2"], [31, "Selesai dikerjakan", "usr-teknisi2"]]),
    wo(11, "ast-006", "Modifikasi", "Pemasangan sensor EO/IR CN235 MPA", "Integrasi sensor elektro-optik baru untuk misi patroli maritim.", "Sedang", "selesai", "usr-teknisi3", 70, -45, 90, 96,
      [["Pemasangan bracket sensor", true], ["Integrasi kabel & konsol", true], ["Uji darat", true], ["Uji terbang", true]], [],
      [[70, "WO dibuat", "usr-petugas"], [66, "Mulai dikerjakan", "usr-teknisi3"], [46, "Selesai dikerjakan", "usr-teknisi3"]]),
    wo(12, "ast-031", "Preventif", "Kalibrasi meter aliran truk avtur", "Kalibrasi tahunan flow meter.", "Rendah", "selesai", "usr-teknisi4", 33, -26, 3, 3,
      [["Kalibrasi flow meter", true], ["Uji kebocoran selang", true]], [], [[33, "WO dibuat", "usr-petugas"], [27, "Selesai dikerjakan", "usr-teknisi4"]]),
    wo(13, "ast-017", "Korektif", "Perbaikan datalink UAV NX-5202", "Link telemetri putus sesaat pada jarak > 150 km.", "Tinggi", "dikerjakan", "usr-teknisi3", 5, 6, 12, 4,
      [["Pemeriksaan antena datalink", true], ["Update firmware modem", false], ["Uji jarak jauh", false]], [], [[5, "WO dibuat", "usr-petugas2"], [4, "Mulai dikerjakan", "usr-teknisi3"]]),
    wo(14, "ast-045", "Korektif", "Perbaikan atap Gedung Markas Komando", "Kebocoran atap lantai 5 sayap timur.", "Sedang", "baru", undefined, 1, 21, 40, 0,
      [["Survei kerusakan", false], ["Pengajuan RAB", false]], [], [[1, "WO dibuat", "usr-admin"]]),
    wo(15, "ast-001", "Preventif", "Penggantian ban roda pendarat AX-1301", "Ban roda pendarat utama mencapai batas keausan.", "Sedang", "selesai", "usr-teknisi", 55, -50, 10, 9,
      [["Lepas roda", true], ["Pasang ban baru", true], ["Tekanan & balancing", true]],
      [{ partId: "prt-08", qty: 2 }],
      [[55, "WO dibuat", "usr-petugas"], [53, "Mulai dikerjakan", "usr-teknisi"], [51, "Selesai dikerjakan", "usr-teknisi"]]),
    wo(16, "ast-036", "Korektif", "Perbaikan transmisi bus personel", "Transmisi selip; biaya perbaikan dinilai tidak ekonomis.", "Rendah", "dibatalkan", "usr-teknisi4", 60, -40, 20, 2,
      [["Diagnosa transmisi", true]], [], [[60, "WO dibuat", "usr-petugas2"], [58, "Diagnosa: tidak ekonomis diperbaiki", "usr-teknisi4"], [57, "WO dibatalkan, diusulkan penghapusan", "usr-petugas2"]]),
  ];
}

function makeStockMovements(now: number): StockMovement[] {
  const m = (id: string, partId: string, type: StockMovement["type"], qty: number, d: number, ref: string, by: string, note?: string): StockMovement =>
    ({ id, partId, type, qty, date: dateOffset(now, -d), ref, by, note });
  return [
    m("mv-01", "prt-08", "keluar", 2, 52, "WO-015", "usr-teknisi"),
    m("mv-02", "prt-13", "keluar", 2, 36, "WO-010", "usr-teknisi2"),
    m("mv-03", "prt-15", "masuk", 200, 30, "BAPB/2026/118", "usr-petugas", "Penerimaan dari kontrak pengadaan"),
    m("mv-04", "prt-16", "keluar", 1, 22, "WO-009", "usr-teknisi4"),
    m("mv-05", "prt-15", "keluar", 18, 17, "WO-004", "usr-teknisi2"),
    m("mv-06", "prt-04", "keluar", 20, 12, "WO-002", "usr-teknisi4"),
    m("mv-07", "prt-15", "keluar", 24, 12, "WO-002", "usr-teknisi4"),
    m("mv-08", "prt-06", "keluar", 2, 5, "WO-007", "usr-teknisi"),
    m("mv-09", "prt-02", "keluar", 1, 7, "WO-001", "usr-teknisi"),
    m("mv-10", "prt-03", "keluar", 1, 7, "WO-001", "usr-teknisi"),
    m("mv-11", "prt-01", "masuk", 1, 3, "BAPB/2026/131", "usr-petugas", "Pengadaan darurat"),
    m("mv-12", "prt-19", "masuk", 4, 9, "BAPB/2026/127", "usr-petugas2"),
  ];
}

function makeFlightLogs(now: number, assets: Asset[], users: User[]): FlightLog[] {
  const r = rng(7);
  const logs: FlightLog[] = [];
  const pilots = ["Kapten Pnb Rizky Hidayat", "Mayor Pnb Yoga Pratama", "Lettu Pnb Nadia Putri", "Kapten Pnb Arif Wibowo", "Lettu Pnb Galih Saputra", "Mayor Pnb Teguh Santosa"];
  const routes = ["Semarang – Jakarta – Semarang", "Semarang – Makassar", "Balikpapan – Tarakan – Balikpapan", "Latihan lokal", "Patroli Selat Makassar", "Kupang – Balikpapan"];
  const flying = assets.filter((a) => a.aviation && a.status === "Aktif");
  let n = 0;
  for (let d = 180; d >= 1; d--) {
    for (const a of flying) {
      if (r() > (a.categoryId === "pesawat" && a.model.includes("G 120") ? 0.18 : 0.08)) continue;
      const isHeli = a.categoryId === "helikopter";
      const isUav = a.categoryId === "nirawak";
      const missions: FlightLog["mission"][] = isUav ? ["Patroli", "Latihan"] : a.model.includes("G 120") || a.model.includes("KT-1") || a.model.includes("EC120") ? ["Latihan"] : isHeli ? ["Angkut", "SAR", "Latihan", "VIP"] : ["Angkut", "Patroli", "Latihan", "Uji Terbang"];
      const hours = Math.round((isUav ? 6 + r() * 10 : 1 + r() * (isHeli ? 2.5 : 4.5)) * 10) / 10;
      logs.push({
        id: `fl-${++n}`,
        assetId: a.id,
        date: dateOffset(now, -d),
        mission: missions[Math.floor(r() * missions.length)],
        hours,
        cycles: isUav ? 1 : 1 + Math.floor(r() * (isHeli ? 4 : 2)),
        pilot: isUav ? "Operator GCS " + ["Lettu Sus Bima", "Serma Eko"][Math.floor(r() * 2)] : pilots[Math.floor(r() * pilots.length)],
        route: isUav ? "Area patroli sektor timur" : routes[Math.floor(r() * routes.length)],
        createdBy: users[3].id,
      });
    }
  }
  return logs;
}

function makeTransfers(now: number): Transfer[] {
  return [
    {
      id: "trf-1", no: "MUT-2026-0011", type: "mutasi", assetIds: ["ast-050"], fromUnitId: "u-d40", toUnitId: "u-pcb", toLocationId: "l-pcb-h1",
      reason: "Penempatan main rotor gearbox cadangan dekat skadron helikopter untuk mempercepat penggantian HX-3204.",
      requestedBy: "usr-petugas2", requestedAt: tsOffset(now, -3, 10), startDate: dateOffset(now, 2), status: "diajukan",
      approvals: [
        { role: "petugas", title: "Verifikasi Petugas Aset", status: "disetujui", by: "usr-petugas", at: tsOffset(now, -2, 11), note: "Dokumen lengkap." },
        { role: "pimpinan", title: "Persetujuan Pimpinan", status: "menunggu" },
      ],
    },
    {
      id: "trf-2", no: "PJM-2026-0006", type: "pinjam", assetIds: ["ast-034"], fromUnitId: "u-pws", toUnitId: "u-pcb",
      reason: "Dukungan kesehatan latihan gabungan di Pangkalan Cakrabuana.",
      requestedBy: "usr-petugas2", requestedAt: tsOffset(now, -16, 9), startDate: dateOffset(now, -12), returnDate: dateOffset(now, 5), status: "diserahkan", handoverAt: tsOffset(now, -12, 8),
      approvals: [
        { role: "petugas", title: "Verifikasi Petugas Aset", status: "disetujui", by: "usr-petugas", at: tsOffset(now, -15, 10) },
        { role: "pimpinan", title: "Persetujuan Pimpinan", status: "disetujui", by: "usr-pimpinan", at: tsOffset(now, -14, 14), note: "Kembalikan dalam kondisi baik." },
      ],
    },
    {
      id: "trf-3", no: "MUT-2026-0009", type: "mutasi", assetIds: ["ast-028"], fromUnitId: "u-pws", toUnitId: "u-d40", toLocationId: "l-d40-hangar",
      reason: "Hydraulic cart dipindahkan ke Depo untuk mendukung overhaul.",
      requestedBy: "usr-petugas", requestedAt: tsOffset(now, -48, 9), startDate: dateOffset(now, -42), status: "diserahkan", handoverAt: tsOffset(now, -42, 9),
      approvals: [
        { role: "petugas", title: "Verifikasi Petugas Aset", status: "disetujui", by: "usr-petugas", at: tsOffset(now, -47, 9) },
        { role: "pimpinan", title: "Persetujuan Pimpinan", status: "disetujui", by: "usr-pimpinan", at: tsOffset(now, -45, 13) },
      ],
    },
    {
      id: "trf-4", no: "PJM-2026-0004", type: "pinjam", assetIds: ["ast-027"], fromUnitId: "u-pws", toUnitId: "u-pcb",
      reason: "Penarikan pesawat angkut saat latihan di Pangkalan Cakrabuana.",
      requestedBy: "usr-petugas2", requestedAt: tsOffset(now, -80, 9), startDate: dateOffset(now, -75), returnDate: dateOffset(now, -60), status: "dikembalikan", handoverAt: tsOffset(now, -75, 8), returnedAt: tsOffset(now, -61, 16),
      approvals: [
        { role: "petugas", title: "Verifikasi Petugas Aset", status: "disetujui", by: "usr-petugas", at: tsOffset(now, -79, 9) },
        { role: "pimpinan", title: "Persetujuan Pimpinan", status: "disetujui", by: "usr-pimpinan", at: tsOffset(now, -78, 10) },
      ],
    },
    {
      id: "trf-5", no: "MUT-2026-0010", type: "mutasi", assetIds: ["ast-037"], fromUnitId: "u-s33", toUnitId: "u-mkp",
      reason: "Simulator dipindahkan ke Mako untuk pelatihan staf.",
      requestedBy: "usr-petugas", requestedAt: tsOffset(now, -30, 9), startDate: dateOffset(now, -20), status: "ditolak",
      approvals: [
        { role: "petugas", title: "Verifikasi Petugas Aset", status: "disetujui", by: "usr-petugas", at: tsOffset(now, -29, 9) },
        { role: "pimpinan", title: "Persetujuan Pimpinan", status: "ditolak", by: "usr-pimpinan", at: tsOffset(now, -27, 15), note: "Simulator masih dibutuhkan untuk siklus latihan semester ini." },
      ],
    },
  ];
}

function makeStockTakes(now: number, assets: Asset[]): StockTake[] {
  const pwsAssets = assets.filter((a) => a.unitId === "u-pws" || a.unitId === "u-s21" || a.unitId === "u-s33");
  const pcbAssets = assets.filter((a) => a.unitId === "u-pcb" || a.unitId === "u-s07" || a.unitId === "u-s52");
  return [
    {
      id: "opn-1", no: "OPN-2026-0004", unitId: "u-pws", locationIds: [], period: "Semester II 2026",
      startedAt: tsOffset(now, -4, 8), status: "berjalan", leaderId: "usr-petugas",
      items: pwsAssets.map((a, i) => ({
        assetId: a.id,
        result: i < 9 ? "ditemukan" : i === 9 ? "tidak_ditemukan" : "belum",
        condition: i < 9 ? a.condition : undefined,
        note: i === 9 ? "Tidak berada di lokasi tercatat, sedang ditelusuri." : undefined,
        checkedAt: i <= 9 ? tsOffset(now, -3 + Math.floor(i / 4), 10 + (i % 4)) : undefined,
        checkedBy: i <= 9 ? "usr-petugas" : undefined,
      })),
    },
    {
      id: "opn-2", no: "OPN-2026-0002", unitId: "u-pcb", locationIds: [], period: "Semester I 2026",
      startedAt: tsOffset(now, -170, 8), completedAt: tsOffset(now, -160, 16), status: "selesai", leaderId: "usr-petugas2",
      items: pcbAssets.map((a, i) => ({
        assetId: a.id,
        result: i === 4 ? "tidak_ditemukan" : "ditemukan",
        condition: i === 4 ? undefined : a.condition,
        note: i === 4 ? "Ditemukan kemudian di Gudang Logistik B; lokasi diperbarui." : undefined,
        checkedAt: tsOffset(now, -168 + (i % 6), 10),
        checkedBy: "usr-petugas2",
      })),
    },
  ];
}

const DISPOSAL_STEPS: Omit<Disposal["approvals"][number], "status">[] = [
  { role: "petugas", title: "Verifikasi Petugas Aset" },
  { role: "teknisi", title: "Pemeriksaan Teknis" },
  { role: "auditor", title: "Reviu Inspektorat" },
  { role: "pimpinan", title: "Persetujuan Pimpinan" },
];
export function disposalSteps() {
  return DISPOSAL_STEPS.map((s) => ({ ...s, status: "menunggu" as const }));
}
export function transferSteps() {
  return [
    { role: "petugas" as const, title: "Verifikasi Petugas Aset", status: "menunggu" as const },
    { role: "pimpinan" as const, title: "Persetujuan Pimpinan", status: "menunggu" as const },
  ];
}

function makeDisposals(now: number): Disposal[] {
  return [
    {
      id: "php-1", no: "PHP-2026-0007", assetIds: ["ast-010", "ast-029", "ast-036"],
      reason: "Aset dalam kondisi rusak berat dan biaya perbaikan melebihi 50% nilai perolehan berdasarkan hasil pemeriksaan teknis.",
      method: "Lelang", estimatedValue: 2_150_000_000, createdBy: "usr-petugas", createdAt: tsOffset(now, -10, 9), status: "diajukan",
      attachments: ["Berita Acara Pemeriksaan Teknis.pdf", "Foto Kondisi Aset.zip", "Daftar Usulan Penghapusan.xlsx"],
      approvals: [
        { ...DISPOSAL_STEPS[0], status: "disetujui", by: "usr-petugas", at: tsOffset(now, -9, 10), note: "Data aset dan dokumen telah diverifikasi." },
        { ...DISPOSAL_STEPS[1], status: "disetujui", by: "usr-teknisi4", at: tsOffset(now, -6, 14), note: "Kerusakan struktur & transmisi tidak ekonomis diperbaiki." },
        { ...DISPOSAL_STEPS[2], status: "menunggu" },
        { ...DISPOSAL_STEPS[3], status: "menunggu" },
      ],
    },
    {
      id: "php-2", no: "PHP-2026-0005", assetIds: [],
      reason: "Peralatan TI usang (12 unit PC) telah habis masa manfaat.",
      method: "Hibah", estimatedValue: 18_000_000, createdBy: "usr-petugas3", createdAt: tsOffset(now, -95, 9), status: "disetujui",
      attachments: ["BA Pemeriksaan.pdf"],
      approvals: DISPOSAL_STEPS.map((s, i) => ({ ...s, status: "disetujui" as const, by: ["usr-petugas", "usr-teknisi3", "usr-auditor", "usr-pimpinan"][i], at: tsOffset(now, -94 + i * 6, 11) })),
    },
    {
      id: "php-3", no: "PHP-2026-0006", assetIds: ["ast-033"],
      reason: "Truk angkut personel dinilai sering rusak.",
      method: "Lelang", estimatedValue: 240_000_000, createdBy: "usr-petugas", createdAt: tsOffset(now, -40, 9), status: "ditolak",
      attachments: ["Riwayat Perbaikan.pdf"],
      approvals: [
        { ...DISPOSAL_STEPS[0], status: "disetujui", by: "usr-petugas", at: tsOffset(now, -39, 10) },
        { ...DISPOSAL_STEPS[1], status: "ditolak", by: "usr-teknisi4", at: tsOffset(now, -35, 10), note: "Kendaraan masih laik operasi setelah servis WO berkala. Usulan belum memenuhi kriteria rusak berat." },
        { ...DISPOSAL_STEPS[2], status: "menunggu" },
        { ...DISPOSAL_STEPS[3], status: "menunggu" },
      ],
    },
  ];
}

function makeAudit(now: number): AuditEntry[] {
  const a = (i: number, d: number, h: number, userId: string, action: string, module: string, ref?: string, detail?: string): AuditEntry =>
    ({ id: `aud-seed-${i}`, at: tsOffset(now, -d, h, (i * 7) % 60), userId, action, module, ref, detail });
  return [
    a(1, 0, 8, "usr-petugas", "Login", "Sistem"),
    a(2, 0, 7, "usr-teknisi", "Login", "Sistem"),
    a(3, 1, 15, "usr-admin", "Membuat", "Work Order", "WO-2026-11-0414", "Perbaikan atap Gedung Markas Komando"),
    a(4, 2, 11, "usr-petugas", "Menyetujui", "Mutasi", "MUT-2026-0011", "Verifikasi Petugas Aset"),
    a(5, 3, 10, "usr-petugas2", "Mengajukan", "Mutasi", "MUT-2026-0011"),
    a(6, 3, 9, "usr-petugas", "Menerima stok", "Suku Cadang", "BRG-4471", "+1 set (BAPB/2026/131)"),
    a(7, 4, 8, "usr-petugas", "Memulai", "Inventarisasi", "OPN-2026-0004", "Semester II 2026 · Pangkalan Wirasakti"),
    a(8, 6, 14, "usr-teknisi4", "Menyetujui", "Penghapusan", "PHP-2026-0007", "Pemeriksaan Teknis"),
    a(9, 6, 9, "usr-teknisi4", "Mengubah status", "Work Order", "WO-2026-11-0402", "Menunggu Part"),
    a(10, 9, 10, "usr-petugas", "Menyetujui", "Penghapusan", "PHP-2026-0007", "Verifikasi Petugas Aset"),
    a(11, 10, 9, "usr-petugas", "Mengajukan", "Penghapusan", "PHP-2026-0007", "3 aset · Lelang"),
    a(12, 12, 13, "usr-teknisi", "Mencatat", "Jam Terbang", "AX-2903", "3,4 jam · Angkut"),
    a(13, 14, 9, "usr-petugas", "Mengubah", "Aset", "PSW-1991-0002", "Status → Dalam Pemeliharaan"),
    a(14, 15, 10, "usr-admin", "Menonaktifkan", "Pengguna", "wulan", "Pindah tugas"),
    a(15, 20, 10, "usr-petugas", "Mendaftarkan", "Aset", "KMP-2018-0003", "Main Rotor Gearbox Cadangan"),
  ];
}

function makeNotifications(now: number): Notification[] {
  return [
    { id: "ntf-1", at: tsOffset(now, -0.2, 8), role: "pimpinan", title: "Mutasi menunggu persetujuan", body: "MUT-2026-0011 · Main Rotor Gearbox Cadangan ke Pangkalan Cakrabuana", href: "/mutasi/detail?id=trf-1", read: [] },
    { id: "ntf-2", at: tsOffset(now, -6, 14), role: "auditor", title: "Penghapusan menunggu reviu", body: "PHP-2026-0007 · 3 aset diusulkan untuk dilelang", href: "/penghapusan/detail?id=php-1", read: [] },
    { id: "ntf-3", at: tsOffset(now, -1, 7), title: "Stok suku cadang di bawah minimum", body: "6 item suku cadang perlu diadakan ulang", href: "/suku-cadang", read: [] },
    { id: "ntf-4", at: tsOffset(now, -2, 7), title: "Sertifikat kelaikan akan berakhir", body: "Beberapa sertifikat kelaikan berakhir dalam 30 hari", href: "/kelaikan", read: [] },
    { id: "ntf-5", at: tsOffset(now, -0.5, 9), userId: "usr-teknisi", title: "Work order baru ditugaskan", body: "WO Inspeksi 150 jam C295 AX-2905", href: "/pemeliharaan/detail?id=wo-007", read: [] },
  ];
}

export function createSeed(now = Date.now()): DB {
  const users = makeUsers(now);
  const assets = makeAssets(now);
  const workOrders = makeWorkOrders(now);
  return {
    version: DB_VERSION,
    users,
    units: UNITS,
    locations: LOCATIONS,
    categories: CATEGORIES,
    assets,
    workOrders,
    spareParts: makeSpareParts(),
    // Seed movements reference work orders as "WO-<seq>"; resolve them to the real WO numbers.
    stockMovements: makeStockMovements(now).map((m) => {
      const match = /^WO-(\d{3})$/.exec(m.ref);
      const wo = match ? workOrders.find((w) => w.id === `wo-${match[1]}`) : undefined;
      return wo ? { ...m, ref: wo.no } : m;
    }),
    flightLogs: makeFlightLogs(now, assets, users),
    transfers: makeTransfers(now),
    stockTakes: makeStockTakes(now, assets),
    disposals: makeDisposals(now),
    audit: makeAudit(now),
    notifications: makeNotifications(now),
  };
}
