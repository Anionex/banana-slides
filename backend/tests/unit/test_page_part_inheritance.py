"""Single-page creation inherits context without changing explicit/imported parts."""
import pytest


def create(client, project_id, index, **extra):
    response = client.post(f'/api/projects/{project_id}/pages', json={
        'order_index': index,
        'outline_content': {'title': 'Page', 'points': []},
        **extra,
    })
    assert response.status_code == 201, response.get_json()
    return response.get_json()['data']


@pytest.mark.parametrize('index', [1, 3])
def test_omitted_part_inherits_nearest_previous(client, sample_project, index):
    project_id = sample_project['project_id']
    create(client, project_id, 0, part='Section A')
    assert create(client, project_id, index)['part'] == 'Section A'


@pytest.mark.parametrize('part', [None, '', '   ', 'Section B'])
def test_explicit_part_is_preserved(client, sample_project, part):
    project_id = sample_project['project_id']
    create(client, project_id, 0, part='Section A')
    assert create(client, project_id, 1, part=part)['part'] == part


def test_insertion_uses_preceding_page_not_following_or_final(client, sample_project):
    project_id = sample_project['project_id']
    create(client, project_id, 0, part='Section A')
    create(client, project_id, 1, part='Section B')
    assert create(client, project_id, 1)['part'] == 'Section A'


def test_ungrouped_predecessor_does_not_inherit_older_section(client, sample_project):
    project_id = sample_project['project_id']
    create(client, project_id, 0, part='Section A')
    create(client, project_id, 1, part=None)
    assert create(client, project_id, 2)['part'] is None


def test_first_page_does_not_inherit_other_projects(client, sample_project):
    create(client, sample_project['project_id'], 0, part='Other project')
    response = client.post('/api/projects', json={'creation_type': 'idea', 'idea_prompt': 'New'})
    other_id = response.get_json()['data']['project_id']
    assert create(client, other_id, 1)['part'] is None
    assert create(client, sample_project['project_id'], 0)['part'] is None


def test_batch_import_keeps_omitted_and_explicit_parts(client, sample_project):
    project_id = sample_project['project_id']
    create(client, project_id, 0, part='Section A')
    response = client.post(f'/api/projects/{project_id}/pages/batch', json={'pages': [
        {'order_index': 1}, {'order_index': 2, 'part': None},
        {'order_index': 3, 'part': ''}, {'order_index': 4, 'part': 'Section B'},
    ]})
    assert response.status_code == 201, response.get_json()
    assert [page['part'] for page in response.get_json()['data']] == [None, None, '', 'Section B']
