import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findComments, findDashes, findViolations, isChecked } from './check-style.mjs';

const EM_DASH = '\u2014';
const EN_DASH = '\u2013';

test('a Java line comment fails', () => {
  assert.deepEqual(findComments('class A {\n  int x; // count\n}\n', 'A.java'), [2]);
});

test('a Java block comment and a Javadoc fail on every line they start', () => {
  const source = 'class A {\n  /* one */\n  /** two */\n  void run() {}\n}\n';
  assert.deepEqual(findComments(source, 'A.java'), [2, 3]);
});

test('a multi-line Java block comment is reported once at its start', () => {
  assert.deepEqual(findComments('/*\n * text\n */\nclass A {}\n', 'A.java'), [1]);
});

test('Java strings and char literals that look like comments pass', () => {
  const source = 'class A {\n  String url = "http://example.org";\n  String quoted = "a \\" // b";\n  char slash = \'/\';\n}\n';
  assert.deepEqual(findComments(source, 'A.java'), []);
});

test('Java text blocks that contain comment markers pass', () => {
  const source = 'class A {\n  String json = """\n    { "path": "a//b" /* x */ }\n    """;\n}\n';
  assert.deepEqual(findComments(source, 'A.java'), []);
});

test('a TypeScript string containing // passes', () => {
  assert.deepEqual(findComments("const url = 'https://example.org/a';\n", 'a.ts'), []);
});

test('a TypeScript template literal with an expression and // passes', () => {
  const source = 'const url = `https://host/${path}//${other("x")}`;\n';
  assert.deepEqual(findComments(source, 'a.ts'), []);
});

test('a TypeScript comment after a template literal fails', () => {
  assert.deepEqual(findComments('const a = `x`; // note\n', 'a.ts'), [1]);
});

test('a TypeScript regular expression literal containing slashes passes', () => {
  assert.deepEqual(findComments('const pattern = /https?:\\/\\/[^/]+/g;\nconst half = total / 2;\n', 'a.ts'), []);
});

test('a division followed by a comment still fails', () => {
  assert.deepEqual(findComments('const half = total / 2; // half\n', 'a.ts'), [1]);
});

test('a JavaScript module comment fails', () => {
  assert.deepEqual(findComments('/* header */\nexport const a = 1;\n', 'a.mjs'), [1]);
});

test('an SCSS url with slashes passes and a line comment fails', () => {
  const source = 'a { background: url(http://example.org/x.png); }\n// note\n';
  assert.deepEqual(findComments(source, 'a.scss'), [2]);
});

test('an HTML comment fails', () => {
  assert.deepEqual(findComments('<div>\n<!-- hidden -->\n</div>\n', 'a.html'), [2]);
});

test('an XML comment fails and a declaration passes', () => {
  assert.deepEqual(findComments('<?xml version="1.0"?>\n<project/>\n', 'pom.xml'), []);
  assert.deepEqual(findComments('<project>\n<!-- x -->\n</project>\n', 'pom.xml'), [2]);
});

test('an Octave percent comment fails and a percent in a format string passes', () => {
  assert.deepEqual(findComments("printf('%d items\\n', n);\n", 'a.m'), []);
  assert.deepEqual(findComments("x = 1; % note\n", 'a.m'), [1]);
  assert.deepEqual(findComments("# note\nx = 1;\n", 'a.m'), [1]);
});

test('an Octave transpose is not a string start', () => {
  assert.deepEqual(findComments("y = x'; z = y';\nname = 'a % b';\n", 'a.m'), []);
});

test('an Octave block comment fails', () => {
  assert.deepEqual(findComments('x = 1;\n%{\nnotes\n%}\ny = 2;\n', 'a.m'), [2, 3, 4]);
});

test('a shell comment fails, the shebang and string hashes pass', () => {
  const source = '#!/usr/bin/env bash\nset -eu\necho "a # b" \'# c\'\nlength=${#name}\nvalue=$#\n# note\nrun # trailing\n';
  assert.deepEqual(findComments(source, 'a.sh'), [6, 7]);
});

test('a heredoc body with hashes passes in shell scripts', () => {
  const source = 'cat <<EOF\n# not a comment\nEOF\n# comment\n';
  assert.deepEqual(findComments(source, 'a.sh'), [4]);
});

test('a YAML comment fails and a hash inside a quoted value passes', () => {
  const source = 'name: ci\ncolor: "#fff"\nurl: http://x/#frag\n# note\non: push # trailing\n';
  assert.deepEqual(findComments(source, 'ci.yml'), [4, 5]);
});

test('a Dockerfile comment fails', () => {
  assert.deepEqual(findComments('FROM node\n# note\nRUN echo "#x"\n', 'Dockerfile'), [2]);
});

test('unknown file types are not scanned for comments', () => {
  assert.deepEqual(findComments('<!-- ADRIAN: question -->\n// text\n', 'README.md'), []);
});

test('an em dash and an en dash fail', () => {
  assert.deepEqual(findDashes(`one\ntwo ${EM_DASH} three\nfour${EN_DASH}five\n`), [2, 3]);
});

test('a hyphen and a minus sign pass', () => {
  assert.deepEqual(findDashes('well-known x - y − z\n'), []);
});

test('violations carry the path, the line and the reason', () => {
  const violations = findViolations('src/A.java', `class A {} // x ${EM_DASH}\n`);
  assert.deepEqual(violations, [
    { path: 'src/A.java', line: 1, message: 'comment in code' },
    { path: 'src/A.java', line: 1, message: 'en or em dash' },
  ]);
});

test('vendored and binary files are skipped', () => {
  assert.equal(isChecked('mvnw'), false);
  assert.equal(isChecked('.mvn/wrapper/maven-wrapper.properties'), false);
  assert.equal(isChecked('web/pnpm-lock.yaml'), false);
  assert.equal(isChecked('docs/demo.gif'), false);
  assert.equal(isChecked('domain/src/main/java/A.java'), true);
});
