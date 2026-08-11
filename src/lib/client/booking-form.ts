import {
  generateTimeSlots,
  computeBookingRange,
  isSlotUnavailable,
  isDateFullyBooked,
  areConsecutiveSlotsAvailable,
  generateReferenceNumber,
  formatTime,
  DURATION_OPTIONS,
  type TimeSlot,
} from '../booking-time';

interface AddonOption {
  id: string;
  name: string;
  description?: string;
  price: string;
  unit: string;
}

interface BookingState {
  date: string;
  startSlotIndex: number | null;
  durationHours: number;
  players: number;
  sessionType: string;
  addonIds: string[];
  fullName: string;
  mobile: string;
  email: string;
  city: string;
  preferredContact: string;
  specialRequests: string;
  agreedToTerms: boolean;
}

const SESSION_TYPES = ['Casual Play', 'Open Play', 'Training', 'Tournament', 'Private Event'];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function initBookingForm(addons: AddonOption[]) {
  const root = document.getElementById('booking-form-root');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);

  const state: BookingState = {
    date: params.get('date') || todayISO(),
    startSlotIndex: params.has('slot') ? Number(params.get('slot')) : null,
    durationHours: params.has('duration') ? Number(params.get('duration')) : 1,
    players: 4,
    sessionType: 'Casual Play',
    addonIds: [],
    fullName: '',
    mobile: '',
    email: '',
    city: '',
    preferredContact: 'Mobile Call',
    specialRequests: '',
    agreedToTerms: false,
  };

  let currentStep = 1;
  const TOTAL_STEPS = 5;

  // --- Elements ---------------------------------------------------------
  const stepPanels = Array.from(root.querySelectorAll<HTMLElement>('[data-step-panel]'));
  const stepDots = Array.from(root.querySelectorAll<HTMLElement>('[data-step-dot]'));
  const progressBar = document.getElementById('booking-progress-bar');
  const dateInput = document.getElementById('bk-date') as HTMLInputElement;
  const slotsGrid = document.getElementById('bk-slots-grid') as HTMLElement;
  const fullyBookedMsg = document.getElementById('bk-fully-booked') as HTMLElement;
  const durationSelect = document.getElementById('bk-duration') as HTMLSelectElement;
  const slotSummary = document.getElementById('bk-slot-summary') as HTMLElement;
  const peakBadge = document.getElementById('bk-peak-badge') as HTMLElement;

  // --- Step 1: schedule ---------------------------------------------------
  function renderDurationOptions() {
    durationSelect.innerHTML = DURATION_OPTIONS.map((d) => `<option value="${d.hours}">${d.label}</option>`).join('');
    durationSelect.value = String(state.durationHours);
  }

  function renderSlots() {
    slotsGrid.innerHTML = '';
    const slots = generateTimeSlots(state.date);
    const fullyBooked = isDateFullyBooked(state.date);
    fullyBookedMsg.classList.toggle('hidden', !fullyBooked);
    slotsGrid.classList.toggle('hidden', fullyBooked);

    slots.forEach((slot: TimeSlot) => {
      const unavailable = isSlotUnavailable(state.date, slot.index);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = [
        'slot-btn',
        unavailable ? 'slot-unavailable' : '',
        state.startSlotIndex === slot.index ? 'slot-selected' : '',
        slot.isPeak ? 'slot-peak' : '',
      ].join(' ');
      btn.disabled = unavailable;
      btn.setAttribute('aria-pressed', String(state.startSlotIndex === slot.index));
      btn.dataset.index = String(slot.index);
      btn.innerHTML = `<span>${slot.startLabel}</span>${slot.isNextCalendarDay ? '<span class="slot-next-day">next day</span>' : ''}`;
      btn.addEventListener('click', () => {
        state.startSlotIndex = slot.index;
        renderSlots();
        updateScheduleSummary();
      });
      slotsGrid.appendChild(btn);
    });
  }

  function updateScheduleSummary() {
    if (state.startSlotIndex === null) {
      slotSummary.textContent = 'Select a start time to see your session details.';
      peakBadge.classList.add('hidden');
      return;
    }
    const slots = generateTimeSlots(state.date);
    const startSlot = slots[state.startSlotIndex];
    const hasRoom = areConsecutiveSlotsAvailable(state.date, state.startSlotIndex, Math.ceil(state.durationHours));
    const { start, end } = computeBookingRange(state.date, state.startSlotIndex, state.durationHours);
    slotSummary.innerHTML = hasRoom
      ? `<strong class="text-rc-white">${formatTime(start)} – ${formatTime(end)}</strong> on ${new Date(state.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${end.toDateString() !== start.toDateString() ? ' (ends the following day)' : ''}`
      : `<span class="text-amber-400">This duration isn't fully available starting at ${startSlot.startLabel}. Try a shorter duration or a different start time.</span>`;
    peakBadge.classList.remove('hidden');
    peakBadge.textContent = startSlot.isPeak ? 'Peak Hours' : 'Off-Peak';
    peakBadge.classList.toggle('bk-badge-peak', startSlot.isPeak);
    peakBadge.classList.toggle('bk-badge-offpeak', !startSlot.isPeak);
  }

  dateInput.min = todayISO();
  dateInput.value = state.date;
  renderDurationOptions();
  renderSlots();
  updateScheduleSummary();

  dateInput.addEventListener('change', () => {
    state.date = dateInput.value || todayISO();
    state.startSlotIndex = null;
    renderSlots();
    updateScheduleSummary();
  });
  durationSelect.addEventListener('change', () => {
    state.durationHours = Number(durationSelect.value);
    updateScheduleSummary();
  });

  // --- Step 2: players & options -----------------------------------------
  const playersInput = document.getElementById('bk-players') as HTMLInputElement;
  const sessionTypeRadios = root.querySelectorAll<HTMLInputElement>('input[name="sessionType"]');
  const addonsContainer = document.getElementById('bk-addons') as HTMLElement;

  addonsContainer.innerHTML = addons
    .map(
      (a) => `
      <label class="bk-addon-card">
        <input type="checkbox" value="${a.id}" data-addon-checkbox />
        <span class="flex-1">
          <span class="block font-heading font-semibold text-sm text-rc-white">${a.name}</span>
          <span class="block text-xs text-rc-silver-dark">${a.description || ''} · ${a.price} ${a.unit}</span>
        </span>
      </label>`
    )
    .join('');

  playersInput.addEventListener('input', () => {
    state.players = Number(playersInput.value) || 1;
  });
  sessionTypeRadios.forEach((r) => r.addEventListener('change', () => { if (r.checked) state.sessionType = r.value; }));
  addonsContainer.querySelectorAll<HTMLInputElement>('[data-addon-checkbox]').forEach((box) => {
    box.addEventListener('change', () => {
      state.addonIds = Array.from(addonsContainer.querySelectorAll<HTMLInputElement>('[data-addon-checkbox]:checked')).map((b) => b.value);
    });
  });

  // --- Step 3: customer info ----------------------------------------------
  const nameInput = document.getElementById('bk-name') as HTMLInputElement;
  const mobileInput = document.getElementById('bk-mobile') as HTMLInputElement;
  const emailInput = document.getElementById('bk-email') as HTMLInputElement;
  const cityInput = document.getElementById('bk-city') as HTMLInputElement;
  const contactMethodSelect = document.getElementById('bk-contact-method') as HTMLSelectElement;
  const requestsInput = document.getElementById('bk-requests') as HTMLTextAreaElement;

  // --- Step 4: review -------------------------------------------------------
  const reviewEl = document.getElementById('bk-review') as HTMLElement;
  const termsCheckbox = document.getElementById('bk-terms') as HTMLInputElement;

  function renderReview() {
    const slots = generateTimeSlots(state.date);
    const startSlot = state.startSlotIndex !== null ? slots[state.startSlotIndex] : null;
    const { start, end } = state.startSlotIndex !== null ? computeBookingRange(state.date, state.startSlotIndex, state.durationHours) : { start: null, end: null };
    const dateLabel = new Date(state.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const selectedAddons = addons.filter((a) => state.addonIds.includes(a.id));
    const baseRate = startSlot?.isPeak ? 350 : 250;
    const estTotal = baseRate * state.durationHours;

    reviewEl.innerHTML = `
      <dl class="grid sm:grid-cols-2 gap-5 text-sm">
        <div><dt class="bk-review-label">Date</dt><dd class="bk-review-value">${dateLabel}</dd></div>
        <div><dt class="bk-review-label">Time</dt><dd class="bk-review-value">${start && end ? `${formatTime(start)} – ${formatTime(end)}` : 'Not selected'}</dd></div>
        <div><dt class="bk-review-label">Duration</dt><dd class="bk-review-value">${state.durationHours} hour(s)</dd></div>
        <div><dt class="bk-review-label">Players</dt><dd class="bk-review-value">${state.players}</dd></div>
        <div><dt class="bk-review-label">Session Type</dt><dd class="bk-review-value">${state.sessionType}</dd></div>
        <div><dt class="bk-review-label">Rate Type</dt><dd class="bk-review-value">${startSlot?.isPeak ? 'Peak' : 'Off-Peak'}</dd></div>
        <div class="sm:col-span-2"><dt class="bk-review-label">Add-ons</dt><dd class="bk-review-value">${selectedAddons.length ? selectedAddons.map((a) => a.name).join(', ') : 'None selected'}</dd></div>
        <div><dt class="bk-review-label">Full Name</dt><dd class="bk-review-value">${state.fullName || '—'}</dd></div>
        <div><dt class="bk-review-label">Mobile</dt><dd class="bk-review-value">${state.mobile || '—'}</dd></div>
        <div><dt class="bk-review-label">Email</dt><dd class="bk-review-value">${state.email || '—'}</dd></div>
        <div><dt class="bk-review-label">Preferred Contact</dt><dd class="bk-review-value">${state.preferredContact}</dd></div>
      </dl>
      <div class="mt-7 pt-6 border-t border-white/10 flex items-center justify-between">
        <span class="text-xs uppercase tracking-wide text-rc-silver-dark">Estimated Total (demo rate)</span>
        <span class="font-display text-3xl font-extrabold text-rc-lime">₱${estTotal.toLocaleString()}+</span>
      </div>
      <p class="text-xs text-rc-silver-dark mt-2">Final total confirmed by our team, including any add-ons above. A deposit may be requested to secure peak-hour or event bookings (placeholder — confirm official deposit policy).</p>
    `;
  }

  // --- Navigation -----------------------------------------------------------
  function validateStep(step: number): boolean {
    if (step === 1) {
      if (state.startSlotIndex === null) {
        alert('Please select a start time for your session.');
        return false;
      }
      if (!areConsecutiveSlotsAvailable(state.date, state.startSlotIndex, Math.ceil(state.durationHours))) {
        alert("This duration isn't fully available for the selected start time. Please choose a shorter duration or different time.");
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (!state.players || state.players < 1) {
        alert('Please enter a valid number of players.');
        return false;
      }
      return true;
    }
    if (step === 3) {
      state.fullName = nameInput.value.trim();
      state.mobile = mobileInput.value.trim();
      state.email = emailInput.value.trim();
      state.city = cityInput.value.trim();
      state.preferredContact = contactMethodSelect.value;
      state.specialRequests = requestsInput.value.trim();
      const form = document.getElementById('bk-info-form') as HTMLFormElement;
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }
      return true;
    }
    if (step === 4) {
      if (!termsCheckbox.checked) {
        alert('Please agree to the Terms and Conditions to continue.');
        return false;
      }
      return true;
    }
    return true;
  }

  function goToStep(step: number) {
    if (step > currentStep && !validateStep(currentStep)) return;
    currentStep = Math.max(1, Math.min(TOTAL_STEPS, step));
    stepPanels.forEach((panel) => {
      const panelStep = Number(panel.dataset.stepPanel);
      panel.classList.toggle('hidden', panelStep !== currentStep);
    });
    stepDots.forEach((dot) => {
      const dotStep = Number(dot.dataset.stepDot);
      dot.classList.toggle('bk-dot-active', dotStep === currentStep);
      dot.classList.toggle('bk-dot-done', dotStep < currentStep);
    });
    if (progressBar) progressBar.style.width = `${((currentStep - 1) / (TOTAL_STEPS - 1)) * 100}%`;
    if (currentStep === 4) renderReview();
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  root.querySelectorAll<HTMLButtonElement>('[data-step-next]').forEach((btn) => {
    btn.addEventListener('click', () => goToStep(currentStep + 1));
  });
  root.querySelectorAll<HTMLButtonElement>('[data-step-back]').forEach((btn) => {
    btn.addEventListener('click', () => goToStep(currentStep - 1));
  });

  // --- Step 5: submit ---------------------------------------------------------
  const submitBtn = document.getElementById('bk-submit') as HTMLButtonElement;
  const submitIdle = document.getElementById('bk-submit-idle') as HTMLElement;
  const submitLoading = document.getElementById('bk-submit-loading') as HTMLElement;
  const submitSuccess = document.getElementById('bk-submit-success') as HTMLElement;
  const submitError = document.getElementById('bk-submit-error') as HTMLElement;
  const referenceEl = document.getElementById('bk-reference') as HTMLElement;
  const retryBtn = document.getElementById('bk-retry') as HTMLButtonElement;

  async function submitBooking() {
    submitIdle.classList.add('hidden');
    submitError.classList.add('hidden');
    submitLoading.classList.remove('hidden');
    submitBtn.disabled = true;

    const slots = generateTimeSlots(state.date);
    const startSlot = state.startSlotIndex !== null ? slots[state.startSlotIndex] : null;
    const { start, end } = state.startSlotIndex !== null ? computeBookingRange(state.date, state.startSlotIndex, state.durationHours) : { start: null, end: null };
    const reference = generateReferenceNumber();

    try {
      const formData = new URLSearchParams();
      formData.set('form-name', 'booking');
      formData.set('reference', reference);
      formData.set('date', state.date);
      formData.set('startTime', start ? formatTime(start) : '');
      formData.set('endTime', end ? formatTime(end) : '');
      formData.set('duration', String(state.durationHours));
      formData.set('players', String(state.players));
      formData.set('sessionType', state.sessionType);
      formData.set('addons', state.addonIds.join(', '));
      formData.set('fullName', state.fullName);
      formData.set('mobile', state.mobile);
      formData.set('email', state.email);
      formData.set('city', state.city);
      formData.set('preferredContact', state.preferredContact);
      formData.set('specialRequests', state.specialRequests);

      // Simulate the latency of a real booking backend (see README for
      // future Netlify Functions / database integration points).
      const submission = fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      }).catch(() => null); // Netlify Forms may not be live outside of a deployed site — degrade gracefully.
      await Promise.all([submission, new Promise((r) => setTimeout(r, 1200))]);

      try {
        sessionStorage.setItem(
          'rc-last-booking',
          JSON.stringify({
            reference,
            dateLabel: new Date(state.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
            timeLabel: start && end ? `${formatTime(start)} – ${formatTime(end)}` : '',
            durationLabel: `${state.durationHours} hour(s)`,
            players: String(state.players),
            sessionType: state.sessionType,
            name: state.fullName,
            mobile: state.mobile,
            email: state.email,
          })
        );
      } catch {
        /* sessionStorage unavailable — confirmation page will show a generic message */
      }

      submitLoading.classList.add('hidden');
      submitSuccess.classList.remove('hidden');
      referenceEl.textContent = reference;
    } catch (err) {
      submitLoading.classList.add('hidden');
      submitError.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
    }
  }

  submitBtn?.addEventListener('click', submitBooking);
  retryBtn?.addEventListener('click', submitBooking);

  goToStep(1);
}
