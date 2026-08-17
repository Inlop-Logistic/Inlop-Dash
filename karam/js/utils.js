/**
 * KARAM · utils.js — helpers generales
 */
(function (global) {
  function uid() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function todayKey(d) {
    const date = d ? new Date(d) : new Date();
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  function formatCOP(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  }

  function formatNumber(value) {
    return (Number(value) || 0).toLocaleString('es-CO');
  }

  function formatDate(d) {
    if (!d) return '-';
    const date = new Date(d);
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDateTime(d) {
    if (!d) return '-';
    const date = new Date(d);
    return date.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

  function dayName(d) {
    const date = d ? new Date(d) : new Date();
    return DAY_NAMES[date.getDay()];
  }

  function isDateInRange(d, start, end) {
    const t = new Date(d).setHours(0, 0, 0, 0);
    if (start && t < new Date(start).setHours(0, 0, 0, 0)) return false;
    if (end && t > new Date(end).setHours(23, 59, 59, 999)) return false;
    return true;
  }

  function startOfWeek(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // lunes como inicio
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function waLink(phone, message) {
    const clean = String(phone || '').replace(/[^0-9]/g, '');
    const text = encodeURIComponent(message);
    return `https://wa.me/${clean}?text=${text}`;
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function toCSV(rows, headers) {
    const esc = (v) => {
      const s = String(v ?? '');
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const head = headers.map((h) => esc(h.label)).join(';');
    const body = rows.map((r) => headers.map((h) => esc(typeof h.value === 'function' ? h.value(r) : r[h.value])).join(';')).join('\n');
    return head + '\n' + body;
  }

  function downloadCSV(filename, csv) {
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function toast(msg, type) {
    const host = document.getElementById('toastHost');
    if (!host) return alert(msg);
    const el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.textContent = msg;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 250);
    }, 3200);
  }

  function confirmAction(message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      const msgEl = document.getElementById('confirmMessage');
      const yesBtn = document.getElementById('confirmYes');
      const noBtn = document.getElementById('confirmNo');
      msgEl.textContent = message;
      modal.classList.add('open');
      const cleanup = (val) => {
        modal.classList.remove('open');
        yesBtn.onclick = null;
        noBtn.onclick = null;
        resolve(val);
      };
      yesBtn.onclick = () => cleanup(true);
      noBtn.onclick = () => cleanup(false);
    });
  }

  global.KaramUtils = {
    uid, nowISO, todayKey, formatCOP, formatNumber, formatDate, formatDateTime,
    dayName, isDateInRange, startOfWeek, waLink, escapeHtml, toCSV, downloadCSV,
    toast, confirmAction, DAY_NAMES,
  };
})(window);
