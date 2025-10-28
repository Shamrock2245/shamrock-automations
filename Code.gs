/***** Qualified Arrests Form → Sheet mapper *****/
const QA = {
  SHEET_ID: "1_8jmb3UsbDNWoEtD2_5O27JNvXKBExrQq2pG0W-mPJI",
  TAB_NAME: "Qualified_Arrests",
  TIMEZONE: "America/New_York",
  MAX_CELL: 49000,
};

// ===== Entry points =====

// Called from client: google.script.run.withSuccessHandler(...).submitQualified(formData)
function submitQualified(form) {
  const sheet = getQASheet_();
  const headers = getHeaders_(sheet);
  const row = mapFormToRow_(form || {}, headers);
  sheet.appendRow(row);
  return {
    ok: true,
    written: headers.reduce((o, h, i) => ((o[h] = row[i]), o), {}),
  };
}

// Optional: prefill helper for your Form.html (fetch a row by booking number, etc.)
function fetchRowForBooking(bookingNumber) {
  const sheet = getQASheet_();
  const headers = getHeaders_(sheet);
  const bIndex = headers.indexOf("Booking_Number");
  if (bIndex === -1) return null;
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const values = sheet.getRange(2, 1, last - 1, headers.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (
      String(values[i][bIndex] || "").trim() ===
      String(bookingNumber || "").trim()
    ) {
      return headers.reduce((o, h, idx) => ((o[h] = values[i][idx]), o), {});
    }
  }
  return null;
}

// ===== Core mapping =====

function mapFormToRow_(form, headers) {
  // helpers
  const g = (names, def = "") => {
    // accept a single name or array of aliases; prefer first that exists
    const list = Array.isArray(names) ? names : [names];
    for (let i = 0; i < list.length; i++) {
      const k = list[i];
      if (form && form[k] != null && form[k] !== "") return String(form[k]);
    }
    return def;
  };
  const normState = (s) =>
    String(s || "")
      .trim()
      .toUpperCase();
  const limit = (s, n = QA.MAX_CELL) => {
    s = s == null ? "" : String(s);
    return s.length > n ? s.slice(0, n - 3) + "..." : s;
  };
  const toYMD = (d) => {
    d = String(d || "").trim();
    // already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return d;
    const mm = ("0" + m[1]).slice(-2),
      dd = ("0" + m[2]).slice(-2),
      yy = m[3];
    return `${yy}-${mm}-${dd}`;
  };
  const to24h = (t) => {
    t = String(t || "").trim();
    const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return t;
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ap = (m[3] || "").toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return `${("0" + h).slice(-2)}:${min}:00`;
  };
  const money = (s) => {
    s = String(s || "")
      .replace(/[,$]/g, "")
      .trim();
    if (!s || isNaN(Number(s))) return s;
    // keep as plain string; don’t force decimals in case you like integers
    return s;
  };
  const joinCharges = (c) => {
    if (Array.isArray(c)) return c.join(" | ");
    return String(c || "");
  };

  // Build Full_Name if not provided
  const first = g(["firstName", "first", "fname"]);
  const middle = g(["middleName", "middle", "mname"]);
  const last = g(["lastName", "last", "lname"]);
  let full = g("fullName");
  if (!full) {
    full = [last, [first, middle].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");
  }

  // Values by logical field (form)
  const map = {
    Scrape_Timestamp: new Date(),
    Booking_Number: g(["bookingNumber", "booking_no", "bookingId"]),
    Person_ID: g(["personId", "inmateId", "permNo"]),
    Full_Name: full,
    First_Name: first,
    Middle_Name: middle,
    Last_Name: last,
    DOB: toYMD(g(["dob", "dateOfBirth"])),
    Booking_Date: toYMD(g(["bookingDate"])),
    Booking_Time: to24h(g(["bookingTime"])),
    Status: g(["currentStatus", "status"]),
    Facility: g(["currentFacility", "facility", "location"]),
    Race: g("race"),
    Sex: g(["sex", "gender"]),
    Height: g("height"),
    Weight: g("weight"),
    Address: g(["address", "streetAddress"]),
    City: g("city"),
    State: normState(g("state")),
    ZIP: g(["zip", "zipcode", "postalCode"]),
    Mugshot_URL: g(["mugshotUrl", "photoUrl"]),
    Charges: joinCharges(g("charges")),
    Bond_Amount: money(g("bondAmount")),
    Bond_Paid: g("bondPaid"),
    Bond_Type: g("bondType"),
    Court_Type: g("courtType"),
    Case_Number: g(["caseNumber", "docketNumber"]),
    Court_Date: toYMD(g("courtDate")),
    Court_Time: to24h(g("courtTime")),
    Court_Location: g("courtLocation"),
    Detail_URL: g("detailUrl"),

    // optional extras (only used if your sheet has these headers)
    Phone: g("phone"),
    Email: g("email"),
    Notes: g("notes"),
  };

  // Emit row in the exact order of headers; unknown headers get blank
  return headers.map((h) => limit(map[h]));
}

// ===== Sheet helpers =====
function getQASheet_() {
  const ss = SpreadsheetApp.openById(QA.SHEET_ID);
  let sh = ss.getSheetByName(QA.TAB_NAME);
  if (!sh) sh = ss.insertSheet(QA.TAB_NAME);
  // Ensure headers exist (only append missing; won’t reorder your sheet)
  const needed = [
    "Scrape_Timestamp",
    "Booking_Number",
    "Person_ID",
    "Full_Name",
    "First_Name",
    "Middle_Name",
    "Last_Name",
    "DOB",
    "Booking_Date",
    "Booking_Time",
    "Status",
    "Facility",
    "Race",
    "Sex",
    "Height",
    "Weight",
    "Address",
    "City",
    "State",
    "ZIP",
    "Mugshot_URL",
    "Charges",
    "Bond_Amount",
    "Bond_Paid",
    "Bond_Type",
    "Court_Type",
    "Case_Number",
    "Court_Date",
    "Court_Time",
    "Court_Location",
    "Detail_URL",
    // optional:
    "Phone",
    "Email",
    "Notes",
  ];
  if (sh.getLastRow() === 0)
    sh.getRange(1, 1, 1, needed.length).setValues([needed]);
  return sh;
}

function getHeaders_(sheet) {
  const lastCol = sheet.getLastColumn();
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  return headerRow.map((h) => String(h || "").trim());
}
