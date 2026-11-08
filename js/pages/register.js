(() => {
  const $ = (id) => document.getElementById(id);
  const playerForm = $("player-form");
  const teamForm = $("team-form");
  $("init-skills").innerHTML = APP.skillFields({}, "initial");
  APP.bindRanges(playerForm);
  const today = APP.dateInput();
  const shifted = (years, extraDays = 0) => {
    const date = new Date(today + "T12:00:00Z");
    date.setUTCFullYear(date.getUTCFullYear() + years);
    date.setUTCDate(date.getUTCDate() + extraDays);
    return date.toISOString().slice(0, 10);
  };
  $("player-dob").min = shifted(-25, 1);
  $("player-dob").max = shifted(-13);
  function loadTeams() {
    const selected = $("player-team").value;
    $("player-team").innerHTML =
      '<option value="">Free agent — no team yet</option>' +
      APP.data.teams
        .map(
          (team) =>
            `<option value="${APP.escapeHtml(team.name)}">${APP.escapeHtml(team.name)} · ${APP.escapeHtml(team.city)}</option>`,
        )
        .join("");
    $("player-team").value = selected;
  }
  function guardianRequired() {
    return $("player-dob").value && APP.ageOn($("player-dob").value) < 18;
  }
  function updateGuardian() {
    const required = guardianRequired();
    $("guardian-section").hidden = !required;
    $("guardian-section")
      .querySelectorAll("input")
      .forEach((input) => {
        input.disabled = !required;
        input.required = !!required;
      });
    $("waiver-label").textContent = required
      ? "I am the player’s parent/guardian. I have read and agree to the participation waiver. *"
      : "I have read and agree to the participation waiver. *";
  }
  $("player-dob").addEventListener("change", updateGuardian);
  if (new URLSearchParams(location.search).get("type") === "team")
    APP.selectTab("reg-team");
  const me = APP.currentUser();
  if (me) {
    $("team-login-notice").hidden = true;
    $("team-coach").value = me.name;
    $("team-email").value = me.email;
  } else
    teamForm
      .querySelectorAll("input,select,button")
      .forEach((input) => (input.disabled = true));
  loadTeams();
  function validateFile(file, kind) {
    if (!file) throw new Error("Please attach your medical clearance form.");
    const allowed =
      kind === "medical"
        ? ["application/pdf", "image/jpeg", "image/png", "image/webp"]
        : ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type))
      throw new Error(
        kind === "medical"
          ? "Use a PDF, JPG, PNG, or WebP medical document."
          : "Use a JPG, PNG, or WebP image.",
      );
    if (file.size > (kind === "medical" ? 2 : 5) * 1024 * 1024)
      throw new Error(
        kind === "medical"
          ? "The medical document must be 2 MB or smaller."
          : "The image must be 5 MB or smaller.",
      );
  }
  function readDocument(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () =>
        reject(
          new Error("The document could not be read. Please select it again."),
        );
      reader.readAsDataURL(file);
    });
  }
  playerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!APP.validate(playerForm)) return;
    const button = playerForm.querySelector("[type=submit]");
    APP.setBusy(button, true, "Saving player…");
    APP.clearMessage(playerForm);
    try {
      const values = APP.formData(playerForm);
      const age = APP.ageOn(values.dob);
      if (age < 13 || age >= 25)
        throw new Error(
          "Players must be aged 13–24 on the day of registration.",
        );
      if (
        APP.data.players.some(
          (player) =>
            player.email?.toLowerCase() === values.email.toLowerCase(),
        )
      )
        throw new Error(
          "A player with this email is already registered. Contact your coach to update the existing profile.",
        );
      if (values.name.split(/\s+/).length < 2)
        throw new Error("Enter your first and last name.");
      if (
        guardianRequired() &&
        values.guardianSignature.toLowerCase() !==
          values.guardianName.toLowerCase()
      )
        throw new Error(
          "The parent/guardian signature must match the name entered above.",
        );
      const medicalFile = playerForm.elements.medical.files[0];
      const photoFile = playerForm.elements.photo.files[0];
      validateFile(medicalFile, "medical");
      if (photoFile) validateFile(photoFile, "photo");
      let photo = null;
      if (photoFile) {
        photo = await APP.readImage(photoFile);
        if (window.SYNC?.ready) {
          const remote = await SYNC.uploadFile(
            "profiles",
            photoFile,
            "players",
          );
          if (remote) photo = remote;
        }
      }
      const medicalUrl = await readDocument(medicalFile);
      const stats = Object.fromEntries(
        APP.skills.map(([key]) => [
          key,
          Number(playerForm.elements[`skill_${key}`].value),
        ]),
      );
      const player = {
        id: APP.uid(),
        userId: APP.currentUser()?.id,
        name: values.name,
        dob: values.dob,
        age,
        email: values.email,
        phone: values.phone,
        position: values.position,
        team: values.team,
        jersey: values.jersey,
        photo,
        emergency: values.emergency,
        conditions: values.conditions,
        waiver: {
          signed: true,
          signedAt: new Date().toISOString(),
          guardian: guardianRequired()
            ? {
                name: values.guardianName,
                phone: values.guardianPhone,
                signature: values.guardianSignature,
              }
            : null,
        },
        photoConsent: !!values.photoConsent,
        codeOfConduct: !!values.codeOfConduct,
        medical: {
          name: medicalFile.name,
          type: medicalFile.type,
          size: medicalFile.size,
          url: medicalUrl,
          storage: "device",
        },
        stats,
        mvps: 0,
        registeredAt: new Date().toISOString(),
      };
      APP.data.players.push(player);
      if (!APP.save()) {
        APP.data.players.pop();
        throw new Error(APP.storageError);
      }
      $("player-success-copy").textContent =
        `${player.name} is registered${player.team ? " with " + player.team : " as a free agent"}. Your medical document is saved on this device; contact and medical details are excluded from public sync.`;
      playerForm.hidden = true;
      $("player-success").hidden = false;
      $("player-success").scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    } catch (error) {
      APP.formMessage(playerForm, error.message);
    } finally {
      APP.setBusy(button, false);
    }
  });
  $("register-another").addEventListener("click", () => {
    playerForm.reset();
    playerForm
      .querySelectorAll(".file-name")
      .forEach((node) => (node.textContent = "No file selected"));
    $("init-skills").innerHTML = APP.skillFields({}, "initial");
    APP.bindRanges(playerForm);
    APP.clearMessage(playerForm);
    updateGuardian();
    playerForm.hidden = false;
    $("player-success").hidden = true;
    $("player-name").focus();
  });
  teamForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const user = APP.currentUser();
    if (!user) {
      location.href = "login.html?returnTo=register.html%3Ftype%3Dteam";
      return;
    }
    if (!APP.validate(teamForm)) return;
    const button = teamForm.querySelector("[type=submit]");
    APP.setBusy(button, true, "Saving team…");
    APP.clearMessage(teamForm);
    try {
      const values = APP.formData(teamForm);
      if (
        APP.data.teams.some(
          (team) => team.name.toLowerCase() === values.name.toLowerCase(),
        )
      )
        throw new Error(
          "A team already uses this name. Please choose a distinct team name.",
        );
      const file = teamForm.elements.logo.files[0];
      let logo = null;
      if (file) {
        validateFile(file, "logo");
        logo = await APP.readImage(file, 320);
        if (window.SYNC?.ready) {
          const remote = await SYNC.uploadFile("profiles", file, "teams");
          if (remote) logo = remote;
        }
      }
      const team = {
        id: APP.uid(),
        name: values.name,
        city: values.city,
        coach: values.coach,
        contact: values.contact,
        email: values.email,
        level: values.level,
        logo,
        rosterSize: Number(values.rosterSize || 12),
        members: [user.id],
        captainId: user.id,
        createdAt: new Date().toISOString(),
      };
      APP.data.teams.push(team);
      if (!APP.save()) {
        APP.data.teams.pop();
        throw new Error(APP.storageError);
      }
      $("team-success-copy").textContent =
        `${team.name} is registered in ${team.city}. You are its captain. Share the exact team name with your players so they can select it when registering.`;
      teamForm.hidden = true;
      $("team-success").hidden = false;
      $("team-success").scrollIntoView({ block: "center", behavior: "smooth" });
      loadTeams();
    } catch (error) {
      APP.formMessage(teamForm, error.message);
    } finally {
      APP.setBusy(button, false);
    }
  });
  window.addEventListener("gzvm:refresh", loadTeams);
})();
