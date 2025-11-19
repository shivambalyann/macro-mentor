# utils.py
import pandas as pd
from typing import Tuple, Dict, List

# --- Calculation helpers (same logic as earlier) ---
def calculate_bmr(weight_kg: float, height_cm: float, age: int, gender: str) -> float:
    g = (gender or "other").lower()
    if g == "male":
        return 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    if g == "female":
        return 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    return 10 * weight_kg + 6.25 * height_cm - 5 * age - 78

def calculate_daily_calories(bmr: float, activity_level: str, fitness_goal: str) -> int:
    activity_multipliers = {
        'sedentary': 1.2,
        'lightly active': 1.375,
        'moderately active': 1.55,
        'very active': 1.725,
        'athlete': 1.9
    }
    mult = activity_multipliers.get(activity_level.lower(), 1.2)
    calories = bmr * mult
    goal_adjustments = {'fat loss': -500, 'maintenance': 0, 'muscle gain': 300}
    calories += goal_adjustments.get(fitness_goal.lower(), 0)
    return max(1200, int(round(calories)))

def calculate_macros(total_calories: int, protein_target_g: float) -> Dict[str,int]:
    protein_calories = protein_target_g * 4
    if protein_calories >= total_calories:
        allowed_protein_cal = max(0, total_calories - 200)
        protein_target_g = allowed_protein_cal / 4
        protein_calories = protein_target_g * 4
    remaining = total_calories - protein_calories
    carb_cal = remaining * 0.55
    fat_cal = remaining * 0.45
    carbs_g = carb_cal / 4
    fats_g = fat_cal / 9
    return {
        'protein_g': int(round(protein_target_g)),
        'carbs_g': int(round(carbs_g)),
        'fats_g': int(round(fats_g))
    }

# --- Meal plan generator: greedy fractional servings ---
def load_foods_from_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    # normalize columns
    expected = {'food','calories','protein','type'}
    missing = expected - set(df.columns)
    if missing:
        raise ValueError(f"CSV missing columns: {missing}")
    # ensure numeric types
    df['calories'] = pd.to_numeric(df['calories'], errors='coerce').fillna(0)
    df['protein'] = pd.to_numeric(df['protein'], errors='coerce').fillna(0)
    return df

def generate_meal_plan_df(food_df: pd.DataFrame, total_calories: int, protein_target_g: float, max_items:int=25) -> Tuple[List[Dict], Dict, str]:
    if food_df.empty:
        return [], {'cal':0,'prot':0}, "Food database empty."

    # prepare
    df = food_df[food_df['calories'] > 0].copy()
    df['prot_per_cal'] = df['protein'] / df['calories']
    df.sort_values('prot_per_cal', ascending=False, inplace=True)
    plan = []
    tot_cal = 0.0
    tot_prot = 0.0
    iterations = 0

    foods = df.to_dict('records')
    if not foods:
        return [], {'cal':0,'prot':0}, "No usable foods."

    while (tot_cal < total_calories * 0.98 or tot_prot < protein_target_g * 0.98) and iterations < 500:
        iterations += 1
        chosen = foods[0]  # highest density
        rem_prot = max(0, protein_target_g - tot_prot)
        rem_cal = max(0, total_calories - tot_cal)
        by_prot = (rem_prot / chosen['protein']) if chosen['protein'] > 0 else 2.0
        by_cal = rem_cal / chosen['calories'] if chosen['calories'] > 0 else 2.0
        add_serv = min(2.0, max(0.1, min(by_prot, by_cal)))
        if add_serv <= 0:
            add_serv = 0.25
        add_cals = chosen['calories'] * add_serv
        add_prot = chosen['protein'] * add_serv
        tot_cal += add_cals
        tot_prot += add_prot
        # merge into plan
        found = False
        for p in plan:
            if p['food'] == chosen['food']:
                p['servings'] += add_serv
                p['calories'] += add_cals
                p['protein'] += add_prot
                found = True
                break
        if not found:
            plan.append({
                'food': chosen['food'],
                'servings': add_serv,
                'calories': add_cals,
                'protein': add_prot
            })
        if len(plan) > max_items:
            break

    note = ""
    if tot_cal < total_calories * 0.9 or tot_prot < protein_target_g * 0.9:
        note = "Targets not fully met — expand food DB or allow larger servings."

    # round values for output
    for p in plan:
        p['servings'] = round(p['servings'], 2)
        p['calories'] = int(round(p['calories']))
        p['protein'] = round(p['protein'], 1)

    totals = {'cal': int(round(tot_cal)), 'prot': int(round(tot_prot))}
    return plan, totals, note
