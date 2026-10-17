const express = require('express'); 
const mongoose = require('mongoose'); 

const app = express(); 
app.use(express.json()); 

// 🚀 VERCEL SERVERLESS DB CONNECTION LOGIC
let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  try {
    const MONGO_URI = process.env.MONGO_URI; 
    if (!MONGO_URI) throw new Error("MONGO_URI is missing!");
    const db = await mongoose.connect(MONGO_URI);
    isConnected = db.connections[0].readyState === 1;
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    throw error;
  }
};

// 🛡️ License Schema (UPDATED WITH PIN & MAC ADDRESS)
const LicenseSchema = new mongoose.Schema({ 
  labId: { type: String, required: true, unique: true }, 
  labName: String, 
  pin: { type: String, required: true }, // NEW: 4-digit PIN
  macAddress: { type: String, default: "" }, // NEW: Hardware Lock
  expiryDate: String, 
  working: { type: Boolean, default: true } 
}); 
const License = mongoose.models.License || mongoose.model('License', LicenseSchema); 

app.get('/', (req, res) => {
  res.send("🚀 LIMS Licensing Server is RUNNING Successfully!");
});

// ----------------------------------------------------
// 🛡️ SUPER ADMIN DASHBOARD UI
// ----------------------------------------------------
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>LIMS Super Admin</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 min-h-screen font-sans text-gray-800">
      
      <!-- 🔒 LOGIN SCREEN -->
      <div id="loginScreen" class="flex items-center justify-center min-h-screen">
        <div class="bg-white p-8 rounded-xl shadow-2xl w-96 text-center">
          <h2 class="text-2xl font-black text-blue-700 mb-2">Admin Login</h2>
          <p class="text-gray-500 mb-6 text-sm">Enter secret key to manage labs</p>
          <input type="password" id="secretInput" placeholder="Enter Secret Key" class="w-full p-3 border rounded-lg outline-none focus:border-blue-500 text-center mb-4">
          <button onclick="login()" class="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition">Unlock Dashboard</button>
          <p id="loginError" class="text-red-500 text-sm mt-3 font-bold hidden"></p>
        </div>
      </div>

      <!-- 🎛️ MAIN DASHBOARD -->
      <div id="mainDashboard" class="hidden max-w-6xl mx-auto py-10 px-4">
        <div class="flex justify-between items-center mb-8">
          <h1 class="text-3xl font-black text-blue-700">LIMS Admin Control</h1>
          <button onclick="logout()" class="text-sm font-bold text-red-600 hover:underline">Logout</button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <!-- Add New Lab Form (UPDATED WITH PIN) -->
          <div class="bg-white p-6 rounded-xl shadow-lg h-fit">
            <h2 class="text-xl font-bold mb-4">Add New Lab</h2>
            <form id="licenseForm" class="flex flex-col gap-4">
              <div>
                <label class="text-sm font-bold text-gray-700">Lab ID (Sequence)</label>
                <input type="text" id="labId" placeholder="e.g. LAB_001" required class="w-full p-2 border rounded outline-none focus:border-blue-500 uppercase mt-1">
              </div>
              <div>
                <label class="text-sm font-bold text-gray-700">Login PIN (4-Digit)</label>
                <input type="text" id="labPin" placeholder="e.g. 1234" required maxlength="4" class="w-full p-2 border rounded outline-none focus:border-blue-500 mt-1">
              </div>
              <div>
                <label class="text-sm font-bold text-gray-700">Lab Name</label>
                <input type="text" id="labName" placeholder="e.g. City Path Lab" required class="w-full p-2 border rounded outline-none focus:border-blue-500 mt-1">
              </div>
              <div>
                <label class="text-sm font-bold text-gray-700">Expiry Date</label>
                <input type="date" id="expiryDate" required class="w-full p-2 border rounded outline-none focus:border-blue-500 mt-1">
              </div>
              <button type="submit" class="bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700 mt-2">
                Create Lab License
              </button>
            </form>
            <div id="formMsg" class="mt-3 text-center font-bold text-sm hidden"></div>
          </div>

          <!-- Labs List Table (SCROLL ADDED HERE) -->
          <div class="bg-white p-6 rounded-xl shadow-lg md:col-span-2 max-h-[550px] overflow-y-auto">
            <h2 class="text-xl font-bold mb-4 sticky top-0 bg-white z-10 py-2">Registered Labs</h2>
            <table class="w-full text-left border-collapse">
              <thead class="sticky top-12 bg-gray-100 z-10">
                <tr class="text-gray-600 text-sm uppercase">
                  <th class="p-3 border-b">Lab ID</th>
                  <th class="p-3 border-b">Lab Name</th>
                  <th class="p-3 border-b">PIN</th>
                  <th class="p-3 border-b">Expiry</th>
                  <th class="p-3 border-b text-center">App Access</th>
                  <th class="p-3 border-b text-center">Hardware Lock</th>
                </tr>
              </thead>
              <tbody id="labsTableBody">
                <!-- Rows will be injected by JS -->
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <script>
        let adminSecret = '';

        async function login() {
          const input = document.getElementById('secretInput').value;
          if(!input) return;
          adminSecret = input;
          const success = await fetchLabs();
          if(success) {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainDashboard').style.display = 'block';
          } else {
            const err = document.getElementById('loginError');
            err.innerText = "❌ Incorrect Password!";
            err.style.display = 'block';
          }
        }

        function logout() {
          adminSecret = '';
          document.getElementById('secretInput').value = '';
          document.getElementById('mainDashboard').style.display = 'none';
          document.getElementById('loginScreen').style.display = 'flex';
          document.getElementById('loginError').style.display = 'none';
        }

        async function fetchLabs() {
          try {
            const res = await fetch('/api/admin/get-all', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ adminSecret })
            });
            const data = await res.json();
            if(res.ok) { renderTable(data.licenses); return true; }
            return false;
          } catch (e) { return false; }
        }

        function renderTable(licenses) {
          const tbody = document.getElementById('labsTableBody');
          tbody.innerHTML = '';
          licenses.forEach(lab => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50 transition text-sm';
            
            const toggleHtml = lab.working 
              ? \`<button onclick="toggleStatus('\${lab.labId}', false)" class="bg-green-500 text-white px-3 py-1 rounded-full font-bold text-xs w-16 shadow-md">ON</button>\`
              : \`<button onclick="toggleStatus('\${lab.labId}', true)" class="bg-red-500 text-white px-3 py-1 rounded-full font-bold text-xs w-16 shadow-md">OFF</button>\`;

            const resetMacHtml = lab.macAddress
              ? \`<button onclick="resetMac('\${lab.labId}')" class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded font-bold text-xs shadow-md">Reset PC</button>\`
              : \`<span class="text-gray-400 text-xs italic">Not Locked</span>\`;

            row.innerHTML = \`
              <td class="p-3 font-bold text-blue-700">\${lab.labId}</td>
              <td class="p-3 font-semibold">\${lab.labName}</td>
              <td class="p-3 text-gray-700 font-mono">\${lab.pin}</td>
              <td class="p-3 text-gray-500">\${lab.expiryDate}</td>
              <td class="p-3 text-center">\${toggleHtml}</td>
              <td class="p-3 text-center">\${resetMacHtml}</td>
            \`;
            tbody.appendChild(row);
          });
        }

        async function toggleStatus(labId, newStatus) {
          await fetch('/api/admin/toggle-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ labId, working: newStatus, adminSecret })
          });
          fetchLabs();
        }

        async function resetMac(labId) {
          if(confirm("Unlock this license? The user will have to login again on their new PC.")) {
            await fetch('/api/admin/reset-mac', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ labId, adminSecret })
            });
            fetchLabs();
          }
        }

        document.getElementById('licenseForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const msgBox = document.getElementById('formMsg');
          msgBox.className = "mt-3 text-blue-600 font-bold block";
          msgBox.innerText = "Creating...";

          const payload = {
            labId: document.getElementById('labId').value.toUpperCase(),
            pin: document.getElementById('labPin').value,
            labName: document.getElementById('labName').value,
            expiryDate: document.getElementById('expiryDate').value,
            working: true,
            adminSecret: adminSecret
          };

          const res = await fetch('/api/admin/upsert-license', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          if(res.ok) {
            msgBox.className = "mt-3 text-green-600 font-bold block";
            msgBox.innerText = "✅ Created Successfully!";
            document.getElementById('licenseForm').reset();
            fetchLabs();
          } else {
            msgBox.className = "mt-3 text-red-600 font-bold block";
            msgBox.innerText = "❌ Failed!";
          }
          setTimeout(() => msgBox.style.display = 'none', 3000);
        });
      </script>
    </body>
    </html>
  `);
});

// ----------------------------------------------------
// ⚙️ API ROUTES 
// ----------------------------------------------------

// 1. App se Check License (UPDATED WITH PIN & MAC LOCK)
app.post('/api/check-license', async (req, res) => { 
  try { 
    await connectDB(); 
    const { labId, pin, macAddress } = req.body; 
    
    if (!labId || !pin || !macAddress) {
      return res.json({ working: false, message: 'Incomplete login details.' });
    }
    
    let license = await License.findOne({ labId }); 
    if (!license) return res.json({ working: false, message: 'Invalid Lab ID.' }); 
    
    // Check 1: Match PIN
    if (license.pin !== pin) {
      return res.json({ working: false, message: 'Incorrect PIN.' });
    }

    // Check 2: Expiry
    const today = new Date().toISOString().split('T')[0]; 
    if (today > license.expiryDate) { 
      license.working = false; 
      await license.save(); 
      return res.json({ working: false, message: 'License Expired.' });
    } 

    // Check 3: App Access Blocked?
    if (!license.working) {
      return res.json({ working: false, message: 'Access blocked by Admin.' });
    }

    // Check 4: MAC Address Hardware Lock
    if (!license.macAddress) {
      // First time login - Lock this PC
      license.macAddress = macAddress;
      await license.save();
    } else if (license.macAddress !== macAddress) {
      // Someone trying to use it on a different PC
      return res.json({ working: false, message: 'License locked to another PC. Contact Admin to reset.' });
    }
    
    res.json({ working: true, expiryDate: license.expiryDate, labName: license.labName }); 
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  } 
}); 

// 2. Add New Lab from Dashboard (UPDATED)
app.post('/api/admin/upsert-license', async (req, res) => { 
  try { 
    await connectDB();
    const { labId, labName, pin, expiryDate, working, adminSecret } = req.body; 
    if (adminSecret !== 'MY_SUPER_SECRET_ADMIN_KEY_123') return res.status(401).json({ error: 'Unauthorized' }); 
    
    const updated = await License.findOneAndUpdate( 
      { labId }, { labName, pin, expiryDate, working }, { upsert: true, new: true } 
    ); 
    res.json({ success: true, updated }); 
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  } 
}); 

// 3. Reset Hardware Lock (NEW ROUTE)
app.post('/api/admin/reset-mac', async (req, res) => {
  try {
    await connectDB();
    const { labId, adminSecret } = req.body;
    if (adminSecret !== 'MY_SUPER_SECRET_ADMIN_KEY_123') return res.status(401).json({ error: 'Unauthorized' }); 

    await License.findOneAndUpdate({ labId }, { macAddress: "" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get All Labs for Dashboard Table
app.post('/api/admin/get-all', async (req, res) => {
  try {
    await connectDB();
    const { adminSecret } = req.body;
    if (adminSecret !== 'MY_SUPER_SECRET_ADMIN_KEY_123') return res.status(401).json({ error: 'Unauthorized' }); 
    const licenses = await License.find().sort({ _id: -1 }); 
    res.json({ success: true, licenses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Toggle ON/OFF Status
app.post('/api/admin/toggle-status', async (req, res) => {
  try {
    await connectDB();
    const { labId, working, adminSecret } = req.body;
    if (adminSecret !== 'MY_SUPER_SECRET_ADMIN_KEY_123') return res.status(401).json({ error: 'Unauthorized' }); 
    await License.findOneAndUpdate({ labId }, { working });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================
// ☁️ RESTORE DATA API (Cloud to Local)
// =========================================================
app.post('/api/restore-data', async (req, res) => {
  try {
    await connectDB();
    const { labId } = req.body;
    
    if (!labId) {
      return res.json({ success: false, message: "Lab ID is required" });
    }

    // Cloud se us Lab ID ka saara data nikal lo
    const records = await SyncRecord.find({ labId });
    res.json({ success: true, records, message: "Data fetched successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// ☁️ CLOUD SYNC SCHEMA & ROUTE (REMAINS SAME)
// ==========================================
const SyncDataSchema = new mongoose.Schema({
  labId: { type: String, required: true },
  tableName: { type: String, required: true }, 
  localId: { type: Number, required: true },  
  recordData: { type: Object, required: true },
  lastSyncedAt: { type: Date, default: Date.now }
});
SyncDataSchema.index({ labId: 1, tableName: 1, localId: 1 }, { unique: true });
const SyncRecord = mongoose.models.SyncRecord || mongoose.model('SyncRecord', SyncDataSchema);

app.post('/api/sync-data', async (req, res) => {
  try {
    await connectDB();
    const { labId, records } = req.body; 
    if (!labId || !records || records.length === 0) return res.json({ success: true, message: "No data to sync" });

    const bulkOperations = records.map(record => ({
      updateOne: {
        filter: { labId: labId, tableName: record.tableName, localId: record.localId },
        update: { $set: { recordData: record.recordData, lastSyncedAt: new Date() } },
        upsert: true 
      }
    }));
    await SyncRecord.bulkWrite(bulkOperations);
    res.json({ success: true, message: "Data synced successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;

const PORT = process.env.PORT || 3000; 
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}