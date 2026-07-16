import { beforeEach, describe, expect, test } from 'vitest';
import {
  AVAILABLE_EXTRA_FIELDS_KEY,
  DEFAULT_AVAILABLE_EXTRA_FIELDS,
  loadAvailableExtraFields,
  saveAvailableExtraFields,
} from '@/utils/extraFieldStorage';

describe('extra field storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('keeps valid ordering and custom fields', () => {
    const fields = ['排版布局', '我的字段', '视觉元素', '视觉焦点', '演讲者备注'];
    localStorage.setItem(AVAILABLE_EXTRA_FIELDS_KEY, JSON.stringify(fields));

    expect(loadAvailableExtraFields(localStorage)).toEqual(fields);
  });

  test.each([
    ['malformed JSON', '{bad-json'],
    ['non-array JSON', JSON.stringify({ field: '意外对象' })],
  ])('repairs %s to the default field list', (_label, raw) => {
    localStorage.setItem(AVAILABLE_EXTRA_FIELDS_KEY, raw);

    expect(loadAvailableExtraFields(localStorage)).toEqual(DEFAULT_AVAILABLE_EXTRA_FIELDS);
    expect(localStorage.getItem(AVAILABLE_EXTRA_FIELDS_KEY)).toBe(
      JSON.stringify(DEFAULT_AVAILABLE_EXTRA_FIELDS),
    );
  });

  test('salvages valid strings, removes duplicates, and restores preset fields', () => {
    localStorage.setItem(AVAILABLE_EXTRA_FIELDS_KEY, JSON.stringify([
      '  我的字段  ',
      42,
      '',
      '我的字段',
      '视觉焦点',
    ]));

    expect(loadAvailableExtraFields(localStorage)).toEqual([
      '我的字段',
      '视觉焦点',
      '视觉元素',
      '排版布局',
      '演讲者备注',
    ]);
  });

  test('does not fail when storage access is blocked', () => {
    const blockedStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };

    expect(loadAvailableExtraFields(blockedStorage)).toEqual(DEFAULT_AVAILABLE_EXTRA_FIELDS);
    expect(saveAvailableExtraFields([...DEFAULT_AVAILABLE_EXTRA_FIELDS, '自定义'], blockedStorage)).toEqual([
      ...DEFAULT_AVAILABLE_EXTRA_FIELDS,
      '自定义',
    ]);
  });

  test('keeps recovered custom fields when repaired storage cannot be rewritten', () => {
    const readOnlyStorage = {
      getItem: () => JSON.stringify(['  自定义指标  ', null]),
      setItem: () => { throw new Error('quota exceeded'); },
    };

    expect(loadAvailableExtraFields(readOnlyStorage)).toEqual([
      '自定义指标',
      ...DEFAULT_AVAILABLE_EXTRA_FIELDS,
    ]);
  });
});
