#!/bin/bash
# Captures all GoodHours screens using the currently-logged-in Chrome session
# Run with: bash scripts/capture-all-screens.sh

BASE="https://goodhours.app"
OUT="/Users/abhay/Hourly/design"
mkdir -p "$OUT"

# Chrome window bounds: x,y,width,height
BOUNDS=$(osascript -e 'tell application "Google Chrome" to get bounds of window 1')
X=$(echo $BOUNDS | awk -F', ' '{print $1}')
Y=$(echo $BOUNDS | awk -F', ' '{print $2}')
W=$(echo $BOUNDS | awk -F', ' '{print $3-$1}')
H=$(echo $BOUNDS | awk -F', ' '{print $4-$2}')

capture() {
  local url="$1"
  local name="$2"
  local scroll="${3:-0}"  # optional scroll-to-bottom

  osascript -e "tell application \"Google Chrome\" to set URL of active tab of window 1 to \"${BASE}${url}\""
  sleep 2.5

  if [ "$scroll" = "full" ]; then
    # Capture top
    screencapture -x -R ${X},${Y},${W},${H} "${OUT}/${name}.png"
    echo "✓ ${name}.png"
    # Scroll to bottom and capture again
    osascript -e "tell application \"Google Chrome\" to execute active tab of window 1 javascript \"window.scrollTo(0, document.body.scrollHeight)\""
    sleep 0.8
    screencapture -x -R ${X},${Y},${W},${H} "${OUT}/${name}-scrolled.png"
    echo "✓ ${name}-scrolled.png"
    # Reset scroll
    osascript -e "tell application \"Google Chrome\" to execute active tab of window 1 javascript \"window.scrollTo(0, 0)\""
  else
    screencapture -x -R ${X},${Y},${W},${H} "${OUT}/${name}.png"
    echo "✓ ${name}.png"
  fi
}

click_tab() {
  local selector="$1"
  osascript -e "tell application \"Google Chrome\" to execute active tab of window 1 javascript \"document.querySelector('${selector}')?.click()\""
  sleep 0.8
}

echo ""
echo "=== PUBLIC PAGES ==="
capture "/" "landing-page"

# Scroll down to stats section
osascript -e "tell application \"Google Chrome\" to execute active tab of window 1 javascript \"window.scrollTo(0, 500)\""
sleep 0.5
screencapture -x -R ${X},${Y},${W},${H} "${OUT}/landing-page-stats-bar.png"
echo "✓ landing-page-stats-bar.png"

# Scroll to demo section
osascript -e "tell application \"Google Chrome\" to execute active tab of window 1 javascript \"document.getElementById('demo')?.scrollIntoView()\""
sleep 0.8
screencapture -x -R ${X},${Y},${W},${H} "${OUT}/landing-page-demo-school.png"
echo "✓ landing-page-demo-school.png"

# Click Student tab in demo
osascript -e "tell application \"Google Chrome\" to execute active tab of window 1 javascript \"Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Student')?.click()\""
sleep 0.6
screencapture -x -R ${X},${Y},${W},${H} "${OUT}/landing-page-demo-student.png"
echo "✓ landing-page-demo-student.png"

# Click Partner tab in demo
osascript -e "tell application \"Google Chrome\" to execute active tab of window 1 javascript \"Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Partner'))?.click()\""
sleep 0.6
screencapture -x -R ${X},${Y},${W},${H} "${OUT}/landing-page-demo-partner.png"
echo "✓ landing-page-demo-partner.png"

# Scroll to How It Works
osascript -e "tell application \"Google Chrome\" to execute active tab of window 1 javascript \"document.getElementById('how')?.scrollIntoView()\""
sleep 0.5
screencapture -x -R ${X},${Y},${W},${H} "${OUT}/landing-page-how-it-works.png"
echo "✓ landing-page-how-it-works.png"

# Scroll to Features
osascript -e "tell application \"Google Chrome\" to execute active tab of window 1 javascript \"document.getElementById('features')?.scrollIntoView()\""
sleep 0.5
screencapture -x -R ${X},${Y},${W},${H} "${OUT}/landing-page-features.png"
echo "✓ landing-page-features.png"

# Scroll to CTA + footer
osascript -e "tell application \"Google Chrome\" to execute active tab of window 1 javascript \"window.scrollTo(0, document.body.scrollHeight)\""
sleep 0.5
screencapture -x -R ${X},${Y},${W},${H} "${OUT}/landing-page-cta-footer.png"
echo "✓ landing-page-cta-footer.png"

capture "/login" "login-page"
capture "/signup" "signup-page"
capture "/school/register" "school-register-page"

echo ""
echo "=== SCHOOL ADMIN PAGES (must be logged in as School Admin) ==="
capture "/dashboard" "school-dashboard" "full"
capture "/cohorts" "school-cohorts-list"

# Cohort detail
capture "/cohorts/cmo2yzkx7000dmubfp4owmtwz" "school-cohort-detail-enrolled"

# Cohort Analytics tab
osascript -e "tell application \"Google Chrome\" to execute active tab of window 1 javascript \"Array.from(document.querySelectorAll('button, [role=tab]')).find(b => b.textContent.trim() === 'Analytics')?.click()\""
sleep 0.8
screencapture -x -R ${X},${Y},${W},${H} "${OUT}/school-cohort-detail-analytics.png"
echo "✓ school-cohort-detail-analytics.png"

# Cohort Pending Invites tab
osascript -e "tell application \"Google Chrome\" to execute active tab of window 1 javascript \"Array.from(document.querySelectorAll('button, [role=tab], a')).find(b => b.textContent.includes('Pending Invites'))?.click()\""
sleep 0.8
screencapture -x -R ${X},${Y},${W},${H} "${OUT}/school-cohort-detail-pending-invites.png"
echo "✓ school-cohort-detail-pending-invites.png"

# Cohort Import tab
osascript -e "tell application \"Google Chrome\" to execute active tab of window 1 javascript \"Array.from(document.querySelectorAll('button, [role=tab], a')).find(b => b.textContent.trim() === 'Import')?.click()\""
sleep 0.8
screencapture -x -R ${X},${Y},${W},${H} "${OUT}/school-cohort-detail-import.png"
echo "✓ school-cohort-detail-import.png"

# Cohort on-track / off-track sub-pages
capture "/cohorts/cmo2yzkx7000dmubfp4owmtwz/on-track" "school-cohort-on-track"
capture "/cohorts/cmo2yzkx7000dmubfp4owmtwz/off-track" "school-cohort-off-track"

capture "/beneficiaries" "school-partners-page" "full"
capture "/discover" "school-discover-page" "full"
capture "/submissions" "school-submissions-page" "full"
capture "/students" "school-students-roster" "full"
capture "/students/on-track" "school-students-on-track"
capture "/students/off-track" "school-students-off-track"
capture "/launch" "school-launch-center" "full"
capture "/messages" "school-messages-page"
capture "/settings" "school-settings-page" "full"

echo ""
echo "=== Done! Total screenshots: $(ls ${OUT}/*.png | wc -l) ==="
echo "Output: ${OUT}"
