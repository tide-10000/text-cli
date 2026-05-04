import { describe, it, expect } from 'vitest';
import { parseDirective, DirectiveParseError } from '../src/parser.js';

describe('parseDirective', () => {
  it('parses domain and action without params', () => {
    const r = parseDirective('指令:基础应用;天气查询');
    expect(r.domain).toBe('基础应用');
    expect(r.action).toBe('天气查询');
    expect(r.params).toEqual([]);
    expect(r.directiveKey).toBe('指令:基础应用;天气查询');
  });

  it('parses domain, action, and params', () => {
    const r = parseDirective('指令:基础应用;天气查询,明天,威海');
    expect(r.domain).toBe('基础应用');
    expect(r.action).toBe('天气查询');
    expect(r.params).toEqual(['明天', '威海']);
  });

  it('trims whitespace', () => {
    const r = parseDirective('  指令:基础应用;天气查询,明天  ');
    expect(r.domain).toBe('基础应用');
    expect(r.params).toEqual(['明天']);
  });

  it('accepts full-width colon', () => {
    const r = parseDirective('指令：基础应用;天气查询');
    expect(r.domain).toBe('基础应用');
  });

  it('throws on empty prompt', () => {
    expect(() => parseDirective('')).toThrow(DirectiveParseError);
    expect(() => parseDirective(null)).toThrow(DirectiveParseError);
  });

  it('throws on invalid format', () => {
    expect(() => parseDirective('hello world')).toThrow(DirectiveParseError);
  });

  it('throws on missing semicolon', () => {
    expect(() => parseDirective('指令:基础应用')).toThrow(DirectiveParseError);
  });

  it('throws on exceeding max params', () => {
    const params = Array(11).fill('a').join(',');
    expect(() => parseDirective(`指令:领域;动作,${params}`)).toThrow(DirectiveParseError);
  });

  it('throws on forbidden characters in params', () => {
    expect(() => parseDirective('指令:领域;动作,a;b')).toThrow(DirectiveParseError);
    expect(() => parseDirective('指令:领域;动作,a\nb')).toThrow(DirectiveParseError);
  });

  it('throws on exceeding max length', () => {
    const long = '指令:领域;动作,' + 'x'.repeat(600);
    expect(() => parseDirective(long)).toThrow(DirectiveParseError);
  });

  it('sets raw to trimmed prompt', () => {
    const r = parseDirective('  指令:领域;动作  ');
    expect(r.raw).toBe('指令:领域;动作');
  });
});
