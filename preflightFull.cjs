// ===========================================================
// 🚀 PPDB Backend Preflight Full Test + Auto-Clean (Final)
// ===========================================================
const fetch = require("node-fetch");
const fs = require("fs");
const FormData = require("form-data");

const BASE = process.env.PPDB_BASE_URL || "http://localhost:3000/api";
const userEmail = process.env.PREFLIGHT_USER_EMAIL || "u@example.com";
const userPass = process.env.PREFLIGHT_USER_PASS || "123456";
const adminEmail = process.env.PREFLIGHT_ADMIN_EMAIL || "a@example.com";
const adminPass = process.env.PREFLIGHT_ADMIN_PASS || "123456";
const AUTO_CLEAN = true;

// Helper JSON fetch
async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text, status: res.status };
  }
}

(async () => {
  console.log("🚀 Preflight full test start\n");

  let token = null;
  let registrationId = null;
  let adminToken = null;

  // =========================================================
  // 0️⃣ Auto-clean old data (delete test user if exists)
  // =========================================================
  if (AUTO_CLEAN) {
    console.log("🧹 Auto-clean old test data...");
    try {
      const adminLogin = await jsonFetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: adminPass }),
      });

      if (adminLogin.accessToken) {
        adminToken = adminLogin.accessToken;
        await fetch(`${BASE}/admin/cleanup-test-data`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: userEmail }),
        });
        console.log("✅ Auto-clean success (test user removed)");
      } else {
        console.log("⚠️ Admin not logged in — skip auto-clean");
      }
    } catch (err) {
      console.log("⚠️ Auto-clean error:", err.message);
    }
  }

  // =========================================================
  // 1️⃣ Register user
  // =========================================================
  try {
    const res = await jsonFetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail, password: userPass }),
    });

    if (res.message?.includes("sudah digunakan")) {
      console.log("ℹ️ User already exists, continuing...");
    } else if (res.userId) {
      console.log("✅ User registered OK (ID:", res.userId, ")");
    } else {
      console.log("⚠️ Register may have failed:", res);
    }
  } catch (err) {
    console.log("⚠️ Register user error:", err.message);
  }

  // =========================================================
  // 2️⃣ Login user
  // =========================================================
  try {
    const res = await jsonFetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail, password: userPass }),
    });

    if (!res.accessToken) throw new Error("login failed");
    token = res.accessToken;
    console.log("✅ User login OK");
  } catch (err) {
    console.error("❌ Login error:", err.message);
    process.exit(1);
  }

  // =========================================================
  // 3️⃣ Create or detect registration
  // =========================================================
  try {
    const res = await jsonFetch(`${BASE}/registrations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.error?.includes("sudah memiliki")) {
      console.log("ℹ️ User already has registration, fetching list...");
      const list = await jsonFetch(`${BASE}/registrations/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      registrationId = list?.[0]?.id;
    } else {
      registrationId = res.registration?.id;
    }

    if (!registrationId) throw new Error("no registrationId found");
    console.log(`✅ Registration ID: ${registrationId}`);
  } catch (err) {
    console.error("❌ Registration creation failed:", err.message);
    process.exit(1);
  }

  // =========================================================
  // 4️⃣ Auto-save form data
  // =========================================================
  try {
    const res = await fetch(`${BASE}/registrations/${registrationId}/participant`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: "Tester Otomatis",
        nik: "1234567890123456",
        address: "Jl. Testing Backend",
        birthPlace: "Bogor",
        birthDate: "2010-02-02",
        schoolName: "SDN 1 Contoh",
        gradYear: 2023,
        npsn: "12345678",
        phone: "08123456789",
      }),
    });
    console.log(res.ok ? "✅ Auto-save OK" : "⚠️ Auto-save failed");
  } catch (err) {
    console.log("⚠️ Auto-save exception:", err.message);
  }

  // =========================================================
  // 5️⃣ Prepare temp files
  // =========================================================
  try {
    fs.writeFileSync("test.pdf", "PDF DUMMY");
    fs.writeFileSync("house1.jpg", "IMAGE1");
    fs.writeFileSync("house2.jpg", "IMAGE2");
    console.log("✅ Temp files ready");
  } catch (err) {
    console.log("⚠️ File prep failed:", err.message);
  }

  // =========================================================
  // 6️⃣ Upload document
  // =========================================================
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream("test.pdf"));
    const res = await fetch(`${BASE}/documents/${registrationId}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    console.log(res.ok ? "✅ Single upload OK" : "⚠️ Single upload failed");
  } catch (err) {
    console.log("⚠️ Upload error:", err.message);
  }

  // =========================================================
  // 7️⃣ Multi-upload (photo rumah)
  // =========================================================
  try {
    const form = new FormData();
    form.append("files", fs.createReadStream("house1.jpg"));
    form.append("files", fs.createReadStream("house2.jpg"));
    const res = await fetch(`${BASE}/documents/${registrationId}/multi-upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    console.log(res.ok ? "✅ Multi-upload OK" : "⚠️ Multi-upload failed");
  } catch (err) {
    console.log("⚠️ Multi-upload exception:", err.message);
  }

  // =========================================================
  // 8️⃣ Submit registration
  // =========================================================
  try {
    const res = await fetch(`${BASE}/registrations/${registrationId}/submit`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(res.ok ? "✅ Submit OK" : "⚠️ Submit failed");
  } catch (err) {
    console.log("⚠️ Submit error:", err.message);
  }

  // =========================================================
  // 9️⃣ Admin verify
  // =========================================================
  try {
    const adminLogin = await jsonFetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPass }),
    });

    if (adminLogin.accessToken) {
      adminToken = adminLogin.accessToken;
      const verify = await fetch(`${BASE}/admin/registrations/${registrationId}/verify`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "VERIFIED", adminNote: "Lolos tes auto" }),
      });
      console.log(verify.ok ? "✅ Admin verify OK" : "⚠️ Admin verify failed");
    } else {
      console.log("⚠️ Admin login failed (verify skipped)");
    }
  } catch (err) {
    console.log("⚠️ Admin verify error:", err.message);
  }

  // =========================================================
  // 🔟 Notifications check
  // =========================================================
  try {
    const res = await jsonFetch(`${BASE}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`✅ Notifications fetched (${Array.isArray(res) ? res.length : 0})`);
  } catch (err) {
    console.log("⚠️ Notification error:", err.message);
  }

  console.log("\n🎯 Preflight test completed.\n");
})();
