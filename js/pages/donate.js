(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => APP.escapeHtml(value);
  const form = $("donate-form");
  const money = (value) => `MK ${Number(value || 0).toLocaleString("en-GB")}`;
  function presets() {
    document
      .querySelectorAll("[data-amt]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.amt === form.elements.amount.value),
        ),
      );
  }
  document.querySelectorAll("[data-amt]").forEach((button) =>
    button.addEventListener("click", () => {
      form.elements.amount.value = button.dataset.amt;
      presets();
    }),
  );
  form.elements.amount.addEventListener("input", presets);
  function render() {
    const records = [...APP.data.donations].reverse();
    $("pledge-total").textContent = money(
      records.reduce((sum, record) => sum + Number(record.amount || 0), 0),
    );
    $("pledge-count").textContent = records.length
      ? `${records.length} support ${records.length === 1 ? "record" : "records"} · payments not verified`
      : "No pledges recorded yet.";
    $("recent-donations").innerHTML = records.length
      ? `<ul class="pledge-list">${records
          .slice(0, 5)
          .map(
            (record) =>
              `<li><div class="cluster"><strong>${esc(record.name || "Anonymous")}</strong><span class="small">${money(record.amount)}</span></div><div class="cluster" style="margin-top:6px">${APP.status(record.paymentStatus === "paid" ? "Payment recorded" : record.status === "pledged" ? "Pledge · unpaid" : "Earlier record · unverified", record.paymentStatus === "paid" ? "" : record.status === "pledged" ? "pending" : "neutral")}<small>${APP.fmtDate(record.date)}</small></div>${record.message ? `<p>${esc(record.message)}</p>` : ""}${record.recurring ? "<small>Monthly support interest · no automatic charge</small>" : ""}</li>`,
          )
          .join("")}</ul>`
      : '<p class="muted small" style="margin-top:16px">A pledge can be the first step. No payment is taken on this page.</p>';
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!APP.validate(form)) return;
    const values = APP.formData(form);
    const amount = Number(values.amount);
    if (!Number.isSafeInteger(amount) || amount < 100 || amount > 100000000)
      return APP.formMessage(
        form,
        "Enter a whole-kwacha amount between MK 100 and MK 100,000,000.",
      );
    const record = {
      id: APP.uid(),
      name: values.name || "Anonymous",
      amount,
      method: values.method,
      message: values.message,
      recurring: !!values.recurring,
      status: "pledged",
      paymentStatus: "unpaid",
      date: new Date().toISOString(),
    };
    APP.data.donations.push(record);
    if (!APP.save()) {
      APP.data.donations.pop();
      APP.formMessage(form, APP.storageError);
      return;
    }
    form.reset();
    presets();
    render();
    APP.formMessage(
      form,
      `Your ${money(amount)} pledge is recorded. No money has been taken. Please arrange the contribution with a verified organiser.`,
      "success",
    );
  });
  render();
  window.addEventListener("gzvm:refresh", render);
})();
