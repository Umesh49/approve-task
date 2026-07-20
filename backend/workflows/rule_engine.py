import json
import datetime

def coerce_value(val):
    """
    Coerces a value (string or basic type) into python type (bool, int, float, date, datetime, list)
    to facilitate type-safe comparisons.
    """
    if val is None:
        return None
    if isinstance(val, (int, float, bool, datetime.date, datetime.datetime, list)):
        return val
    
    if isinstance(val, str):
        val_lower = val.lower().strip()
        if val_lower == 'true':
            return True
        if val_lower == 'false':
            return False
        
        try:
            if '.' in val:
                return float(val)
            return int(val)
        except ValueError:
            pass
        
        for date_format in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d'):
            try:
                dt = datetime.datetime.strptime(val, date_format)
                if date_format == '%Y-%m-%d':
                    return dt.date()
                return dt
            except ValueError:
                pass
        
        try:
            parsed = json.loads(val)
            if isinstance(parsed, (list, dict)):
                return parsed
        except json.JSONDecodeError:
            pass
            
    return val

def compare_values(left, op, right):
    """
    Compares left and right value based on comparison operator.
    """
    c_left = coerce_value(left)
    c_right = coerce_value(right)

    try:
        if op == 'eq':
            return c_left == c_right
        elif op == 'neq':
            return c_left != c_right
        elif op == 'gt':
            if c_left is None or c_right is None:
                return False
            return c_left > c_right
        elif op == 'lt':
            if c_left is None or c_right is None:
                return False
            return c_left < c_right
        elif op == 'gte':
            if c_left is None or c_right is None:
                return False
            return c_left >= c_right
        elif op == 'lte':
            if c_left is None or c_right is None:
                return False
            return c_left <= c_right
        elif op == 'in':
            if c_left is None:
                return False
            if not isinstance(c_right, list):
                if isinstance(c_right, str):
                    c_right = [item.strip() for item in c_right.split(',') if item.strip()]
                else:
                    c_right = [c_right]
            coerced_right = [coerce_value(i) for i in c_right]
            return c_left in coerced_right
        elif op == 'not_in':
            if c_left is None:
                return True
            if not isinstance(c_right, list):
                if isinstance(c_right, str):
                    c_right = [item.strip() for item in c_right.split(',') if item.strip()]
                else:
                    c_right = [c_right]
            coerced_right = [coerce_value(i) for i in c_right]
            return c_left not in coerced_right
    except TypeError:
        return False
    return False

def evaluate_rule_tree(rule_node, request_data, depth=0) -> bool:
    """
    Recursively evaluate a rule tree against the request data.
    Supports a max recursion depth of 10 levels to prevent stack overflow.
    Missing fields default to False.
    """
    if depth > 10:
        raise ValueError("Maximum recursion depth (10) exceeded in rule tree evaluation.")
    
    if rule_node.logical_operator:
        children = rule_node.children.all().order_by('order')
        if not children.exists():
            return rule_node.logical_operator == 'AND'
            
        if rule_node.logical_operator == 'AND':
            for child in children:
                if not evaluate_rule_tree(child, request_data, depth + 1):
                    return False
            return True
        elif rule_node.logical_operator == 'OR':
            for child in children:
                if evaluate_rule_tree(child, request_data, depth + 1):
                    return True
            return False
    else:
        field = rule_node.field_name
        left_val = request_data.get(field)
        if left_val is None:
            return False
        return compare_values(left_val, rule_node.operator, rule_node.value)

def get_rule_actions(workflow, request_data) -> list:
    """
    Evaluate all root rules for a workflow and return a list of actions to apply.
    Returns: [{"action": "skip_stage", "stage_id": "...", "action_target": {...}}, ...]
    """
    actions = []
    root_rules = workflow.rules.filter(parent_rule=None).order_by('order')
    for rule in root_rules:
        if evaluate_rule_tree(rule, request_data):
            stage_id = None
            if rule.action_target and isinstance(rule.action_target, dict):
                stage_id = rule.action_target.get('stage_id')
            if not stage_id and rule.stage_id:
                stage_id = str(rule.stage_id)
                
            actions.append({
                'rule_id': str(rule.id),
                'action': rule.action,
                'action_target': rule.action_target,
                'stage_id': stage_id
            })
    return actions
