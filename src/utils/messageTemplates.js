// src/utils/messageTemplates.js

/**
 * ─────────────────────────────────────────────────────────
 * JSON TEMPLATE CONFIGURATION
 * Add, remove, or edit templates here. 
 * 'condition' determines when the template is shown in the dropdown:
 * - 'unreported' : Shows when waste is NOT submitted.
 * - 'reported'   : Shows when waste IS submitted.
 * - 'always'     : Shows all the time.
 * * Available dynamic variables to use in text:
 * {{caterer}}, {{mealCap}}, {{dateStr}}, {{wasteBreakdown}}
 * ─────────────────────────────────────────────────────────
 */
export const MESSAGE_TEMPLATES = [
  {
    id: 'unreported_reminder',
    label: 'Reminder — Not Reported',
    condition: 'unreported',
    body: `Hi {{caterer}},\n\nThis is a reminder that the waste report for {{mealCap}} on {{dateStr}} has not been submitted yet.\n\nTimely reporting helps us track food waste accurately and plan meals better. Please log the waste data as soon as possible — it only takes a few minutes.\n\nDate: {{dateStr}}\nMeal: {{mealCap}}\nStatus: Not Reported\n\nKindly ensure this is filled in at the earliest. Thank you for your cooperation.\n\nRegards,\nMess Admin`
  },
  {
    id: 'unreported_urgent',
    label: 'Urgent — Overdue Report',
    condition: 'unreported',
    body: `Dear {{caterer}},\n\nWe noticed that the waste report for {{mealCap}} on {{dateStr}} is still pending. This is an urgent follow-up as missing reports affect our monthly waste analytics.\n\nDate: {{dateStr}}\nMeal: {{mealCap}}\nStatus: Overdue\n\nPlease submit the waste data immediately. If there was an issue logging it, feel free to reach out and we'll assist you.\n\nThank you,\nMess Admin`
  },
  {
    id: 'high_waste',
    label: 'High Waste — Needs Attention',
    condition: 'reported',
    body: `Hi {{caterer}},\n\nAfter reviewing the waste report for {{mealCap}} on {{dateStr}}, we noticed the waste levels are higher than expected. We'd like to work together to bring this down.\n\n{{wasteBreakdown}}\n\nWe encourage you to review portion sizes, preparation quantities, and identify any recurring patterns. Reducing waste benefits both costs and sustainability.\n\nPlease share your action plan at your earliest convenience.\n\nRegards,\nMess Admin`
  },
  {
    id: 'good_job',
    label: 'Great Work — Low Waste',
    condition: 'reported',
    body: `Hi {{caterer}},\n\nWe reviewed the waste report for {{mealCap}} on {{dateStr}} and are pleased to see the waste levels are well-managed. Great job!\n\n{{wasteBreakdown}}\n\nKeep up the excellent work. Consistent low waste reflects efficient planning and preparation. Your efforts are appreciated.\n\nRegards,\nMess Admin`
  },
  {
    id: 'feedback_positive',
    label: 'Students Feedback — Positive',
    condition: 'reported',
    body: `Dear {{caterer}},\n\nWe're happy to share that students have given positive feedback for {{mealCap}} on {{dateStr}}. The meal was well-received and students appreciated the quality and taste.\n\n{{wasteBreakdown}}\n\nThis encouraging response from students reflects the effort your team puts in. Thank you for consistently delivering quality meals.\n\nKeep it up!\n\nRegards,\nMess Admin`
  },
  {
    id: 'feedback_negative',
    label: 'Students Feedback — Needs Improvement',
    condition: 'reported',
    body: `Hi {{caterer}},\n\nWe've received feedback from students regarding {{mealCap}} on {{dateStr}} indicating there is room for improvement. We want to address this proactively.\n\n{{wasteBreakdown}}\n\nCommon concerns raised include quality, taste, or portion adequacy. We'd appreciate it if you could look into this and make the necessary adjustments going forward.\n\nPlease connect with us if you'd like to discuss further.\n\nRegards,\nMess Admin`
  },
  {
    id: 'general_checkin',
    label: 'General Check-in',
    condition: 'always',
    body: `Hi {{caterer}},\n\nJust checking in on the {{mealCap}} service for {{dateStr}}. Let us know if you need anything from our end.\n\nRegards,\nMess Admin`
  }
];


/* ─────────────────────────────────────────────────────────
   PROCESSING LOGIC
───────────────────────────────────────────────────────── */

// Replaces the {{variables}} in the JSON template with actual data
const buildMessage = (templateBody, args) => {
  let result = templateBody;
  for (const [key, value] of Object.entries(args)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
};

// Generates the list of templates for the Calendar Dropdown
export const getTemplates = ({ mealType, reported, catererName, mealData, dateStr }) => {
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const mealCap = cap(mealType);
  const caterer = catererName || 'your team';

  const total = mealData?.total?.toFixed(1) ?? '—';
  const plate = Number(mealData?.plate_waste ?? 0).toFixed(1);
  const uncooked = Number(mealData?.kitchen_uncooked ?? 0).toFixed(1);
  const cooked = Number(mealData?.kitchen_cooked ?? 0).toFixed(1);

  const wasteBreakdown = `Date: ${dateStr}\nMeal: ${mealCap}\nTotal Waste: ${total} kg\n   • Plate Waste: ${plate} kg\n   • Uncooked (Kitchen): ${uncooked} kg\n   • Cooked (Kitchen): ${cooked} kg`;

  // Provide available variables to the builder
  const args = { caterer, mealCap, dateStr, wasteBreakdown };

  // Figure out which templates to load
  const condition = reported ? 'reported' : 'unreported';

  return MESSAGE_TEMPLATES
    .filter(t => t.condition === condition || t.condition === 'always')
    .map(t => ({
      id: t.id,
      label: t.label,
      body: buildMessage(t.body, args)
    }));
};

// Intercepts [TEMPLATE]: strings and converts them back to full text for the chat UI
export const parseTemplateMessage = (msgText) => {
  if (typeof msgText === 'string' && msgText.startsWith('[TEMPLATE]:')) {
    try {
      const data = JSON.parse(msgText.substring(11));
      const templates = getTemplates(data.args);
      const found = templates.find(t => t.id === data.id);
      if (found) return found.body;
    } catch (e) {
      console.error("Failed to parse template message", e);
    }
  }
  return msgText;
};