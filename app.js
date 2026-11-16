(function () {
  const FEEDBACK_KEY = "Unihospital.feedback";

  function readFeedback() {
    const saved = localStorage.getItem(FEEDBACK_KEY);
    if (saved === null) return [];

    let feedback;
    try {
      feedback = JSON.parse(saved);
    } catch {
      throw new Error("The saved feedback could not be read.");
    }

    if (!Array.isArray(feedback)) {
      throw new Error("The saved feedback has an invalid format.");
    }
    return feedback;
  }

  function saveFeedback(feedback) {
    try {
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback));
    } catch {
      throw new Error("Could not save feedback in this browser.");
    }
  }

  function showMessage(id, text) {
    const message = document.getElementById(id);
    message.textContent = text;
    message.hidden = false;
  }

  function addText(parent, tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    parent.appendChild(element);
    return element;
  }

  function addButton(parent, text, dataName, id) {
    const button = addText(parent, "button", text, "text-button row-action");
    button.dataset[dataName] = id;
    return button;
  }

  function isAnonymous(entry) {
    return entry.anonymous || !String(entry.patientEmail || "").trim();
  }

  function today() {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")].join("-");
  }

  // Feedback form on feedback.html
  const feedbackForm = document.getElementById("feedback-form");
  if (feedbackForm) {
    const emailInput = feedbackForm.elements.email;
    const emailField = document.getElementById("email-field");
    const message = document.getElementById("feedback-message");

    function updateEmailField() {
      const wantsEmail = feedbackForm.elements.identity.value === "email";
      emailInput.required = wantsEmail;
      emailField.hidden = !wantsEmail;
      if (!wantsEmail) emailInput.value = "";
    }

    document.querySelectorAll('input[name="identity"]').forEach(function (radio) {
      radio.addEventListener("change", updateEmailField);
    });

    feedbackForm.elements.visitDate.value = today();
    updateEmailField();

    feedbackForm.addEventListener("submit", function (event) {
      event.preventDefault();
      message.textContent = "";

      const wantsEmail = feedbackForm.elements.identity.value === "email";
      const email = wantsEmail ? emailInput.value.trim().toLowerCase() : "";
      const entry = {
        id: Date.now() + "-" + Math.random(),
        patientEmail: email,
        visitDate: feedbackForm.elements.visitDate.value,
        category: feedbackForm.elements.category.value,
        rating: Number(feedbackForm.elements.rating.value),
        comments: feedbackForm.elements.comments.value.trim(),
        anonymous: !wantsEmail,
        status: "Pending",
        submittedAt: new Date().toISOString()
      };

      try {
        const feedback = readFeedback();
        feedback.push(entry);
        saveFeedback(feedback);
        feedbackForm.reset();
        feedbackForm.elements.visitDate.value = today();
        updateEmailField();
        message.textContent = "Thank you. Your feedback has been saved in this browser.";
      } catch (error) {
        showMessage("feedback-message", error.message);
      }
    });
  }

  const responseLookupForm = document.getElementById("response-lookup-form");
  if (responseLookupForm) {
    const message = document.getElementById("response-lookup-message");
    const results = document.getElementById("response-lookup-results");

    responseLookupForm.addEventListener("submit", function (event) {
      event.preventDefault();
      message.textContent = "";
      results.textContent = "";

      let feedback;
      try {
        feedback = readFeedback();
      } catch (error) {
        showMessage("response-lookup-message", error.message);
        return;
      }

      const email = responseLookupForm.elements.email.value.trim().toLowerCase();
      const matches = feedback.filter(function (entry) {
        return !isAnonymous(entry) &&
          String(entry.patientEmail || "").trim().toLowerCase() === email;
      }).reverse();

      if (matches.length === 0) {
        message.textContent = "No feedback was found for this email in this browser.";
        return;
      }

      matches.forEach(function (entry) {
        const result = document.createElement("article");
        result.className = "response-result";
        addText(result, "h3", (entry.category || "Feedback") + " - " + (entry.visitDate || "Visit date unavailable"));
        addText(result, "p", entry.response ? "Response from the clinic" : "No response yet", "response-result-status");
        addText(result, "p", entry.response || "The clinic has not responded yet.");
        results.appendChild(result);
      });
    });
  }

  function addCell(row, text, className) {
    return addText(row, "td", text, className);
  }

  // Draw the dashboard table and summary values
  function showDashboard() {
    const rows = document.getElementById("feedback-rows");
    const message = document.getElementById("dashboard-message");
    const filter = document.getElementById("category-filter");
    rows.textContent = "";

    let feedback;
    try {
      feedback = readFeedback();
    } catch (error) {
      showMessage("dashboard-message", error.message);
      return;
    }

    const resolvedTotal = feedback.filter(function (entry) {
      return entry.status === "Resolved";
    }).length;
    const ratingTotal = feedback.reduce(function (total, entry) {
      return total + Number(entry.rating);
    }, 0);

    document.getElementById("total-count").textContent = feedback.length;
    document.getElementById("pending-count").textContent = feedback.length - resolvedTotal;
    document.getElementById("resolved-count").textContent = resolvedTotal;
    document.getElementById("average-rating").innerHTML =
      (feedback.length ? ratingTotal / feedback.length : 0).toFixed(1) + " <small>/ 5</small>";

    feedback.slice().reverse().forEach(function (entry) {
      if (filter.value !== "all" && entry.category !== filter.value) return;

      const row = document.createElement("tr");
      const submitted = entry.submittedAt
        ? new Date(entry.submittedAt).toLocaleString()
        : "";
      const visit = submitted ? `${entry.visitDate}\n${submitted}` : entry.visitDate;
      const anonymous = isAnonymous(entry);
      const patient = anonymous
        ? "Anonymous"
        : (entry.patientEmail || entry.patientName || "Patient");

      addCell(row, visit);
      addCell(row, patient);
      const statusCell = addCell(row, "");
      if (!anonymous) {
        addText(statusCell, "span", entry.status || "Pending",
          entry.status === "Resolved" ? "status resolved" : "status");
      }
      addCell(row, entry.category);
      addCell(row, entry.rating + " / 5");
      addCell(row, entry.comments || "—", "comment-cell");

      const responseCell = addCell(row, "");
      if (anonymous) {
        addText(responseCell, "span", "Cannot reply to anonymous feedback", "response-unavailable");
      } else if (entry.response) {
        addText(responseCell, "p", entry.response, "response-text");
      } else {
        const responseInput = document.createElement("textarea");
        responseInput.className = "response-input";
        responseInput.rows = 3;
        responseInput.maxLength = 1500;
        responseInput.setAttribute("aria-label", "Response to feedback");
        responseInput.placeholder = "Write a response...";
        responseCell.appendChild(responseInput);
        addButton(responseCell, "Send response", "responseId", entry.id);
      }

      rows.appendChild(row);
    });

    if (rows.children.length === 0) {
      message.textContent = feedback.length === 0
        ? "No feedback has been submitted yet."
        : "No feedback matches this service.";
      message.hidden = false;
    } else {
      message.hidden = true;
    }
  }

  function updateFeedback(id, update) {
    try {
      const feedback = readFeedback();
      const entry = feedback.find(function (item) { return item.id === id; });
      if (!entry) {
        throw new Error("That feedback could not be found. Refresh the dashboard and try again.");
      }

      update(entry);
      saveFeedback(feedback);
      showDashboard();
    } catch (error) {
      showMessage("dashboard-message", error.message);
    }
  }

  function saveResponse(id, response) {
    if (!response) {
      showMessage("dashboard-message", "Enter a response before saving.");
      return;
    }
    updateFeedback(id, function (entry) {
      if (isAnonymous(entry)) {
        throw new Error("Responses are unavailable for anonymous feedback.");
      }
      if (entry.response) {
        throw new Error("A response has already been sent for this feedback.");
      }
      entry.response = response;
      entry.status = "Resolved";
    });
  }

  // Dashboard page: load feedback and reload when the service filter changes
  const categoryFilter = document.getElementById("category-filter");
  if (categoryFilter) {
    const rows = document.getElementById("feedback-rows");
    rows.addEventListener("click", function (event) {
      const responseButton = event.target.closest("button[data-response-id]");
      if (responseButton) {
        const responseInput = responseButton.parentElement.querySelector(".response-input");
        saveResponse(responseButton.dataset.responseId, responseInput.value.trim());
        return;
      }

    });
    showDashboard();
    categoryFilter.addEventListener("change", showDashboard);
  }
})();
