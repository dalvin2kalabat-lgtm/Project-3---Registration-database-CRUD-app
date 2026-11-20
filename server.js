const express = require('express');
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'registration',
});

// tables and columns
const TABLES = {
  course: { pk: 'course_id', label: 'Courses', cols: [
    { n: 'course_code' }, { n: 'title' }, { n: 'credits', type: 'number' } ] },
  faculty: { pk: 'faculty_id', label: 'Faculty', cols: [
    { n: 'first_name' }, { n: 'last_name' }, { n: 'email', type: 'email' }, { n: 'department' } ] },
  student: { pk: 'student_id', label: 'Students', cols: [
    { n: 'first_name' }, { n: 'last_name' }, { n: 'email', type: 'email' }, { n: 'major' } ] },
  section: { pk: 'section_id', label: 'Sections', cols: [
    { n: 'course_id', fk: { table: 'course', show: "CONCAT(course_code,' - ',title)" } },
    { n: 'faculty_id', fk: { table: 'faculty', show: "CONCAT(first_name,' ',last_name)" } },
    { n: 'semester' }, { n: 'room' }, { n: 'capacity', type: 'number' } ] },
  enrollment: { pk: 'enrollment_id', label: 'Enrollments', cols: [
    { n: 'student_id', fk: { table: 'student', show: "CONCAT(first_name,' ',last_name)" } },
    { n: 'section_id', fk: { table: 'section', show: "CONCAT('Section ',section_id,' (',semester,')')" } },
    { n: 'grade' } ] },
};

const app = express();
app.use(express.urlencoded({ extended: false }));

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nice = s => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;background:#f5f6f8;color:#222}
nav{background:#1f3a5f;padding:12px 20px}nav a{color:#fff;margin-right:18px;text-decoration:none;font-weight:600}
main{max-width:960px;margin:24px auto;padding:0 16px}
table{border-collapse:collapse;width:100%;background:#fff}th,td{padding:8px 10px;border-bottom:1px solid #ddd;text-align:left}
th{background:#e8ecf2}.btn,button{background:#1f3a5f;color:#fff;border:0;padding:6px 12px;border-radius:4px;text-decoration:none;cursor:pointer;font-size:14px}
.danger{background:#b3261e}form.inline{display:inline}label{display:block;margin:12px 0 4px;font-weight:600}
input,select{padding:7px;width:100%;max-width:360px;box-sizing:border-box}.err{background:#fde7e7;padding:10px;border-radius:4px}
</style></head><body>
<nav><a href="/">Home</a>${Object.entries(TABLES).map(([k, t]) => `<a href="/${k}">${t.label}</a>`).join('')}</nav>
<main>${body}</main></body></html>`;

const fail = (res, e) => res.status(400).send(page('Error',
  `<div class="err"><b>Error:</b> ${esc(e.sqlMessage || e.message)}</div><p><a href="javascript:history.back()">&larr; Back</a></p>`));

app.param('t', (req, res, next, t) => TABLES[t] ? next() : res.status(404).send(page('Not found', '<h2>Unknown table</h2>')));

app.get('/', (req, res) => res.send(page('Registration',
  `<h1>Registration Database</h1><ul>${Object.entries(TABLES).map(([k, t]) =>
    `<li><a href="/${k}">${t.label}</a></li>`).join('')}</ul>`)));

// show all rows
app.get('/:t', async (req, res) => {
  const t = TABLES[req.params.t];
  const sel = t.cols.map(c => c.fk
    ? `(SELECT ${c.fk.show} FROM \`${c.fk.table}\` x WHERE x.\`${TABLES[c.fk.table].pk}\` = t.\`${c.n}\`) AS \`${c.n}\``
    : `t.\`${c.n}\``).join(', ');
  try {
    const [rows] = await pool.query(`SELECT t.\`${t.pk}\` AS id, ${sel} FROM \`${req.params.t}\` t ORDER BY t.\`${t.pk}\``);
    res.send(page(t.label, `<h1>${t.label}</h1><p><a class="btn" href="/${req.params.t}/new">+ Add</a></p>
<table><tr><th>ID</th>${t.cols.map(c => `<th>${nice(c.fk ? c.fk.table : c.n)}</th>`).join('')}<th>Actions</th></tr>
${rows.map(r => `<tr><td>${r.id}</td>${t.cols.map(c => `<td>${esc(r[c.n])}</td>`).join('')}
<td><a class="btn" href="/${req.params.t}/${r.id}/edit">Edit</a>
<form class="inline" method="post" action="/${req.params.t}/${r.id}/delete" onsubmit="return confirm('Delete this record?')">
<button class="danger">Delete</button></form></td></tr>`).join('') || `<tr><td colspan="${t.cols.length + 2}">No records.</td></tr>`}
</table>`));
  } catch (e) { fail(res, e); }
});

async function form(req, res, row) {
  const name = req.params.t, t = TABLES[name];
  try {
    const fields = [];
    for (const c of t.cols) {
      const val = row ? row[c.n] ?? '' : '';
      let input;
      if (c.fk) {
        const [opts] = await pool.query(`SELECT \`${TABLES[c.fk.table].pk}\` AS id, ${c.fk.show} AS label FROM \`${c.fk.table}\` ORDER BY 2`);
        input = `<select name="${c.n}"><option value="">-- none --</option>${opts.map(o =>
          `<option value="${o.id}"${String(o.id) === String(val) ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
      } else {
        input = `<input name="${c.n}" type="${c.type || 'text'}" value="${esc(val)}">`;
      }
      fields.push(`<label>${nice(c.fk ? c.fk.table : c.n)}</label>${input}`);
    }
    const action = row ? `/${name}/${row[t.pk]}` : `/${name}`;
    res.send(page(row ? 'Edit' : 'Add', `<h1>${row ? 'Edit' : 'Add'} ${t.label}</h1>
<form method="post" action="${action}">${fields.join('')}<p><button>Save</button> <a href="/${name}">Cancel</a></p></form>`));
  } catch (e) { fail(res, e); }
}

// add form
app.get('/:t/new', (req, res) => form(req, res, null));
// edit form
app.get('/:t/:id/edit', async (req, res) => {
  const t = TABLES[req.params.t];
  try {
    const [rows] = await pool.query(`SELECT * FROM \`${req.params.t}\` WHERE \`${t.pk}\` = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).send(page('Not found', '<h2>Record not found</h2>'));
    form(req, res, rows[0]);
  } catch (e) { fail(res, e); }
});

const values = t => req => t.cols.map(c => req.body[c.n] === '' || req.body[c.n] === undefined ? null : req.body[c.n]);

// create
app.post('/:t', async (req, res) => {
  const t = TABLES[req.params.t];
  try {
    await pool.query(`INSERT INTO \`${req.params.t}\` (${t.cols.map(c => `\`${c.n}\``).join(', ')}) VALUES (${t.cols.map(() => '?').join(', ')})`, values(t)(req));
    res.redirect(`/${req.params.t}`);
  } catch (e) { fail(res, e); }
});

// delete
app.post('/:t/:id/delete', async (req, res) => {
  const t = TABLES[req.params.t];
  try {
    await pool.query(`DELETE FROM \`${req.params.t}\` WHERE \`${t.pk}\` = ?`, [req.params.id]);
    res.redirect(`/${req.params.t}`);
  } catch (e) { fail(res, e); }
});

// update
app.post('/:t/:id', async (req, res) => {
  const t = TABLES[req.params.t];
  try {
    await pool.query(`UPDATE \`${req.params.t}\` SET ${t.cols.map(c => `\`${c.n}\` = ?`).join(', ')} WHERE \`${t.pk}\` = ?`, [...values(t)(req), req.params.id]);
    res.redirect(`/${req.params.t}`);
  } catch (e) { fail(res, e); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running at http://localhost:${PORT}`));
