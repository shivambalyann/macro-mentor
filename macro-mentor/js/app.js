// frontend/js/app.js (updated)
// ---------- Sample Food Dataset (per serving) ----------
const FOOD_DB = [
    { food: 'Chicken Breast (100g)', calories: 165, protein: 31, type: 'non-vegetarian' },
    { food: 'Brown Rice (1 cup cooked)', calories: 215, protein: 5, type: 'vegetarian' },
    { food: 'Oats (1/2 cup dry)', calories: 150, protein: 5, type: 'vegetarian' },
    { food: 'Milk (1 cup)', calories: 103, protein: 8, type: 'vegetarian' },
    { food: 'Almonds (1/4 cup)', calories: 207, protein: 7, type: 'vegetarian' },
    { food: 'Broccoli (1 cup)', calories: 55, protein: 3.7, type: 'vegetarian' },
    { food: 'Salmon (100g)', calories: 208, protein: 20, type: 'non-vegetarian' },
    { food: 'Egg (1 large)', calories: 78, protein: 6, type: 'non-vegetarian' },
    { food: 'Greek Yogurt (1 cup)', calories: 100, protein: 17, type: 'vegetarian' },
    { food: 'Whey Protein (1 scoop)', calories: 120, protein: 24, type: 'vegetarian' },
    { food: 'Tofu (100g)', calories: 76, protein: 8, type: 'vegetarian' },
    { food: 'Lentils (1 cup cooked)', calories: 230, protein: 18, type: 'vegetarian' },
    { food: 'Paneer (100g)', calories: 265, protein: 18, type: 'vegetarian' }
];

// ---------- Utility calculations ----------
function calculateBMR(weight, height, age, gender) {
    const g = (gender || 'other').toLowerCase();
    if (g === 'male') return 10 * weight + 6.25 * height - 5 * age + 5;
    if (g === 'female') return 10 * weight + 6.25 * height - 5 * age - 161;
    return 10 * weight + 6.25 * height - 5 * age - 78;
}

function calculateDailyCalories(bmr, activity, goal) {
    const mults = { 'sedentary': 1.2, 'lightly active': 1.375, 'moderately active': 1.55, 'very active': 1.725, 'athlete': 1.9 };
    const mult = mults[activity] || 1.2;
    let need = bmr * mult;
    const adjustments = { 'fat loss': -500, 'maintenance': 0, 'muscle gain': 300 };
    need += (adjustments[goal] || 0);
    return Math.max(1200, Math.round(need));
}

function calculateMacros(totalCalories, proteinTargetG) {
    let proteinCalories = proteinTargetG * 4;
    if (proteinCalories >= totalCalories) {
        const allowedProteinCal = Math.max(0, totalCalories - 200);
        proteinTargetG = allowedProteinCal / 4;
        proteinCalories = proteinTargetG * 4;
    }
    const remaining = totalCalories - proteinCalories;
    const carbCal = remaining * 0.55;
    const fatCal = remaining * 0.45;
    const carbsG = carbCal / 4;
    const fatsG = fatCal / 9;
    return { protein: Math.round(proteinTargetG), carbs: Math.round(carbsG), fats: Math.round(fatsG) };
}

// Greedy fractional-serving meal plan generator
function generateMealPlan(foodDB, totalCalories, proteinTarget) {
    if (!foodDB.length) return { plan: [], totals: { cal: 0, prot: 0 }, note: 'No foods available.' };
    const foods = foodDB.filter(f => f.calories > 0).map(f => ({...f, protPerCal: f.protein / f.calories }));
    if (!foods.length) return { plan: [], totals: { cal: 0, prot: 0 }, note: 'Food DB invalid.' };
    foods.sort((a, b) => b.protPerCal - a.protPerCal);

    const plan = [];
    let totCal = 0,
        totProt = 0;
    let iterations = 0;
    while ((totCal < totalCalories * 0.98 || totProt < proteinTarget * 0.98) && iterations < 500) {
        iterations++;
        const chosen = foods[0];
        const remProt = Math.max(0, proteinTarget - totProt);
        const remCal = Math.max(0, totalCalories - totCal);
        let byProt = chosen.protein > 0 ? (remProt / chosen.protein) : 2.0;
        let byCal = remCal / chosen.calories;
        let addServ = Math.min(2.0, Math.max(0.1, Math.min(byProt, byCal)));
        if (addServ <= 0) addServ = 0.25;
        const addCals = chosen.calories * addServ;
        const addProt = chosen.protein * addServ;
        totCal += addCals;
        totProt += addProt;
        const exist = plan.find(p => p.food === chosen.food);
        if (exist) {
            exist.servings += addServ;
            exist.cal += addCals;
            exist.prot += addProt;
        } else plan.push({ food: chosen.food, servings: addServ, cal: addCals, prot: addProt });
        if (plan.length > 25) break;
    }
    const note = (totCal < totalCalories * 0.9 || totProt < proteinTarget * 0.9) ? 'Targets not fully met — expand food DB or allow larger servings.' : '';
    return { plan, totals: { cal: Math.round(totCal), prot: Math.round(totProt) }, note };
}

// ---------- Charts ----------
let barChart = null,
    pieChart = null;

function renderCharts(macros) {
    const barCtx = document.getElementById('macroBar').getContext('2d');
    const pieCtx = document.getElementById('macroPie').getContext('2d');
    const barData = { labels: ['Protein (g)', 'Carbs (g)', 'Fats (g)'], datasets: [{ label: 'Grams', data: [macros.protein, macros.carbs, macros.fats] }] };
    const pieData = { labels: ['Protein kcal', 'Carb kcal', 'Fat kcal'], datasets: [{ data: [macros.protein * 4, macros.carbs * 4, macros.fats * 9] }] };
    if (barChart) barChart.destroy();
    if (pieChart) pieChart.destroy();
    barChart = new Chart(barCtx, { type: 'bar', data: barData, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
    pieChart = new Chart(pieCtx, { type: 'pie', data: pieData, options: { plugins: { legend: { position: 'bottom' } } } });
}

// ---------- UI Wiring (DOM ready) ----------
document.addEventListener('DOMContentLoaded', () => {
    const runBtn = document.getElementById('runBtn');
    const exportBtn = document.getElementById('exportCSV');

    function readInputs() {
        const weight = parseFloat(document.getElementById('weight').value || NaN);
        const height = parseFloat(document.getElementById('height').value || NaN);
        const age = parseInt(document.getElementById('age').value || NaN, 10);
        const gender = document.getElementById('gender').value;
        const diet = document.getElementById('diet').value;
        const activity = document.getElementById('activity').value;
        const goal = document.getElementById('goal').value;
        const protMultiplier = parseFloat(document.getElementById('prot_multiplier').value || NaN);
        return { weight, height, age, gender, diet, activity, goal, protMultiplier };
    }

    function validateInputs({ weight, height, age, protMultiplier }) {
        const errors = [];
        if (isNaN(weight) || weight <= 0) errors.push('Please enter a valid Weight (kg).');
        if (isNaN(height) || height <= 0) errors.push('Please enter a valid Height (cm).');
        if (isNaN(age) || age <= 0) errors.push('Please enter a valid Age.');
        if (isNaN(protMultiplier) || protMultiplier <= 0) errors.push('Please enter a valid Protein multiplier (e.g. 1.6).');
        return errors;
    }

    runBtn.addEventListener('click', () => {
        const inputs = readInputs();
        const errs = validateInputs(inputs);
        if (errs.length) {
            alert(errs.join('\n'));
            return;
        }

        // compute
        const { weight, height, age, gender, diet, activity, goal, protMultiplier } = inputs;
        console.log('Inputs ->', inputs);

        const bmr = calculateBMR(weight, height, age, gender);
        const dailyCal = calculateDailyCalories(bmr, activity, goal);
        const proteinTarget = Math.round(protMultiplier * weight);
        const macros = calculateMacros(dailyCal, proteinTarget);

        // Filter foods by diet
        const foods = (diet === 'vegetarian') ? FOOD_DB.filter(f => f.type === 'vegetarian') : FOOD_DB.slice();
        const gen = generateMealPlan(foods, dailyCal, macros.protein);

        // Update UI
        document.getElementById('calTarget').innerText = dailyCal + ' kcal';
        document.getElementById('protTarget').innerText = macros.protein + ' g';
        document.getElementById('carbFat').innerText = macros.carbs + ' g / ' + macros.fats + ' g';
        document.getElementById('summarySmall').innerText = goal.replace(/\b\w/g, c => c.toUpperCase()) + ' • ' + activity.replace(/\b\w/g, c => c.toUpperCase());

        // render meal list
        const mealList = document.getElementById('mealList');
        mealList.innerHTML = '';
        if (gen.plan.length === 0) {
            mealList.innerHTML = '<div class="muted">No plan could be generated with current foods.</div>';
        } else {
            gen.plan.forEach(item => {
                const el = document.createElement('div');
                el.className = 'meal-item';
                el.innerHTML = `<div>${item.food} <span class="muted" style="font-size:12px">(servings: ${item.servings.toFixed(2)})</span></div><div style="text-align:right">${Math.round(item.cal)} kcal<br/><span class="muted">${item.prot.toFixed(1)} g</span></div>`;
                mealList.appendChild(el);
            });
        }

        document.getElementById('genTotals').innerText = `${gen.totals.cal} kcal · ${gen.totals.prot} g protein`;

        // insights
        const insEl = document.getElementById('insights');
        insEl.innerHTML = '';
        const ins = [];
        if (gen.totals.cal < dailyCal * 0.95) ins.push('Generated calories are lower than target — increase servings or add foods.');
        if (gen.totals.prot < macros.protein * 0.95) ins.push('Protein target not fully met — consider adding high-protein options (whey, chicken, lentils).');
        if (Math.abs(gen.totals.cal - dailyCal) / dailyCal < 0.08) ins.push('Good — plan closely matches calorie target.');
        if (ins.length === 0) ins.push('Plan generated — review servings and adjust to taste.');
        ins.forEach(i => {
            const li = document.createElement('li');
            li.innerText = i;
            insEl.appendChild(li);
        });

        // Charts
        renderCharts(macros);

        // Save last generated for export (safe shape)
        window._lastPlan = { inputs: { weight, height, age, gender, diet, activity, goal, protMultiplier }, dailyCal, macros, plan: gen.plan, totals: gen.totals, note: gen.note };
        console.log('Generated plan ->', window._lastPlan);
    });

    // Export CSV
    exportBtn.addEventListener('click', () => {
        const lp = window._lastPlan;
        if (!lp) { alert('Generate a plan first.'); return; }
        const rows = [
            ['food', 'servings', 'calories', 'protein_g']
        ];
        lp.plan.forEach(p => rows.push([p.food, p.servings.toFixed(2), Math.round(p.cal), p.prot.toFixed(1)]));
        const csv = rows.map(r => r.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'meal_plan.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    });

    // DO NOT auto-run on load anymore
});