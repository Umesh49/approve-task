import pytest
import datetime
from workflows.models import Workflow, Rule
from workflows.rule_engine import evaluate_rule_tree, get_rule_actions

@pytest.fixture
def test_workflow(admin_user):
    return Workflow.objects.create(
        name="Rule Test Workflow",
        description="Testing rule engine",
        created_by=admin_user
    )

@pytest.mark.django_db
def test_simple_rule_evaluation(test_workflow):
    rule = Rule.objects.create(
        workflow=test_workflow,
        field_name="amount",
        operator="gt",
        value="50000",
        action="skip_stage"
    )
    
    assert evaluate_rule_tree(rule, {"amount": 60000}) is True
    assert evaluate_rule_tree(rule, {"amount": 50000}) is False
    assert evaluate_rule_tree(rule, {"amount": 40000}) is False

@pytest.mark.django_db
def test_and_rule_evaluation(test_workflow):
    parent = Rule.objects.create(
        workflow=test_workflow,
        logical_operator="AND",
        action="skip_stage"
    )
    Rule.objects.create(
        workflow=test_workflow,
        parent_rule=parent,
        field_name="amount",
        operator="gt",
        value="50000",
        order=1
    )
    Rule.objects.create(
        workflow=test_workflow,
        parent_rule=parent,
        field_name="department",
        operator="eq",
        value="IT",
        order=2
    )

    assert evaluate_rule_tree(parent, {"amount": 60000, "department": "IT"}) is True
    assert evaluate_rule_tree(parent, {"amount": 60000, "department": "HR"}) is False
    assert evaluate_rule_tree(parent, {"amount": 40000, "department": "IT"}) is False

@pytest.mark.django_db
def test_or_rule_evaluation(test_workflow):
    parent = Rule.objects.create(
        workflow=test_workflow,
        logical_operator="OR",
        action="skip_stage"
    )
    Rule.objects.create(
        workflow=test_workflow,
        parent_rule=parent,
        field_name="amount",
        operator="gt",
        value="50000",
        order=1
    )
    Rule.objects.create(
        workflow=test_workflow,
        parent_rule=parent,
        field_name="department",
        operator="eq",
        value="IT",
        order=2
    )

    assert evaluate_rule_tree(parent, {"amount": 60000, "department": "HR"}) is True
    assert evaluate_rule_tree(parent, {"amount": 40000, "department": "IT"}) is True
    assert evaluate_rule_tree(parent, {"amount": 40000, "department": "HR"}) is False

@pytest.mark.django_db
def test_nested_rule_evaluation(test_workflow):
    root = Rule.objects.create(
        workflow=test_workflow,
        logical_operator="OR",
        action="skip_stage"
    )
    
    and_child = Rule.objects.create(
        workflow=test_workflow,
        parent_rule=root,
        logical_operator="AND",
        order=1
    )
    Rule.objects.create(
        workflow=test_workflow,
        parent_rule=and_child,
        field_name="amount",
        operator="gt",
        value="50000",
        order=1
    )
    Rule.objects.create(
        workflow=test_workflow,
        parent_rule=and_child,
        field_name="department",
        operator="eq",
        value="IT",
        order=2
    )

    Rule.objects.create(
        workflow=test_workflow,
        parent_rule=root,
        field_name="experience",
        operator="lt",
        value="1",
        order=2
    )

    assert evaluate_rule_tree(root, {"amount": 60000, "department": "IT", "experience": 3}) is True
    assert evaluate_rule_tree(root, {"amount": 40000, "department": "HR", "experience": 0.5}) is True
    assert evaluate_rule_tree(root, {"amount": 40000, "department": "IT", "experience": 2}) is False

@pytest.mark.django_db
def test_in_and_not_in_operators(test_workflow):
    rule_in = Rule.objects.create(
        workflow=test_workflow,
        field_name="department",
        operator="in",
        value='["IT", "HR"]',
        action="skip_stage"
    )
    assert evaluate_rule_tree(rule_in, {"department": "IT"}) is True
    assert evaluate_rule_tree(rule_in, {"department": "Finance"}) is False

    rule_notin = Rule.objects.create(
        workflow=test_workflow,
        field_name="department",
        operator="not_in",
        value='["IT", "HR"]',
        action="skip_stage"
    )
    assert evaluate_rule_tree(rule_notin, {"department": "Finance"}) is True
    assert evaluate_rule_tree(rule_notin, {"department": "IT"}) is False

@pytest.mark.django_db
def test_missing_field_defaults_to_false(test_workflow):
    rule = Rule.objects.create(
        workflow=test_workflow,
        field_name="amount",
        operator="gt",
        value="50000"
    )
    # request data misses 'amount'
    assert evaluate_rule_tree(rule, {"department": "IT"}) is False

@pytest.mark.django_db
def test_type_coercion_edge_cases(test_workflow):
    rule_date = Rule.objects.create(
        workflow=test_workflow,
        field_name="date_submitted",
        operator="gte",
        value="2026-07-01"
    )
    assert evaluate_rule_tree(rule_date, {"date_submitted": datetime.date(2026, 7, 18)}) is True
    assert evaluate_rule_tree(rule_date, {"date_submitted": "2026-06-15"}) is False

    rule_bool = Rule.objects.create(
        workflow=test_workflow,
        field_name="is_active",
        operator="eq",
        value="True"
    )
    assert evaluate_rule_tree(rule_bool, {"is_active": True}) is True
    assert evaluate_rule_tree(rule_bool, {"is_active": "true"}) is True
    assert evaluate_rule_tree(rule_bool, {"is_active": False}) is False

@pytest.mark.django_db
def test_empty_rule_tree(test_workflow):
    and_group = Rule.objects.create(
        workflow=test_workflow,
        logical_operator="AND"
    )
    assert evaluate_rule_tree(and_group, {}) is True

    or_group = Rule.objects.create(
        workflow=test_workflow,
        logical_operator="OR"
    )
    assert evaluate_rule_tree(or_group, {}) is False

@pytest.mark.django_db
def test_recursion_depth_limit(test_workflow):
    root = Rule.objects.create(workflow=test_workflow, logical_operator="AND")
    curr = root
    for _ in range(11):
        curr = Rule.objects.create(workflow=test_workflow, parent_rule=curr, logical_operator="AND")
    
    Rule.objects.create(
        workflow=test_workflow,
        parent_rule=curr,
        field_name="amount",
        operator="gt",
        value="10"
    )

    with pytest.raises(ValueError) as excinfo:
        evaluate_rule_tree(root, {"amount": 20})
    assert "Maximum recursion depth" in str(excinfo.value)

@pytest.mark.django_db
def test_get_rule_actions(test_workflow):
    Rule.objects.create(
        workflow=test_workflow,
        field_name="amount",
        operator="gt",
        value="50000",
        action="skip_stage",
        action_target={"stage_id": "manager-review"},
        order=1
    )
    Rule.objects.create(
        workflow=test_workflow,
        field_name="department",
        operator="eq",
        value="IT",
        action="add_approval",
        action_target={"role": "cto"},
        order=2
    )

    actions = get_rule_actions(test_workflow, {"amount": 60000, "department": "IT"})
    assert len(actions) == 2
    assert actions[0]['action'] == 'skip_stage'
    assert actions[1]['action'] == 'add_approval'

    actions_only_one = get_rule_actions(test_workflow, {"amount": 40000, "department": "IT"})
    assert len(actions_only_one) == 1
    assert actions_only_one[0]['action'] == 'add_approval'
