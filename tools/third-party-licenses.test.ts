import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseFromExpression, chooseLicense, parseMavenLicenses, render, spdxFromMavenName } from './third-party-licenses.ts';

const XML = `<licenseSummary><dependencies>
  <dependency><groupId>g</groupId><artifactId>a</artifactId><version>1</version>
    <licenses><license><name>The Apache Software License, Version 2.0</name></license><license><name>Eclipse Public License - v 1.0</name></license></licenses>
  </dependency>
  <dependency><groupId>jakarta.x</groupId><artifactId>api</artifactId><version>2</version>
    <licenses><license><name>EPL 2.0</name></license><license><name>GPL2 w/ CPE</name></license></licenses>
  </dependency>
</dependencies></licenseSummary>`;

test('Maven license names map to SPDX identifiers', () => {
  assert.equal(spdxFromMavenName('The Apache Software License, Version 2.0'), 'Apache-2.0');
  assert.equal(spdxFromMavenName('Eclipse Distribution License - v 1.0'), 'BSD-3-Clause');
  assert.equal(spdxFromMavenName('Eclipse Public License v. 2.0'), 'EPL-2.0');
  assert.equal(spdxFromMavenName('GNU General Public License, version 2 with the GNU Classpath Exception'), 'GPL-2.0-with-classpath-exception');
  assert.equal(spdxFromMavenName('Something Else'), 'Something Else');
});

test('the licenses of every dependency are read from the plugin report', () => {
  assert.deepEqual(parseMavenLicenses(XML), [
    { groupId: 'g', artifactId: 'a', version: '1', licenses: ['Apache-2.0', 'EPL-1.0'] },
    { groupId: 'jakarta.x', artifactId: 'api', version: '2', licenses: ['EPL-2.0', 'GPL-2.0-with-classpath-exception'] },
  ]);
});

test('a permissive license is chosen over the others on offer', () => {
  assert.deepEqual(chooseLicense(['EPL-1.0', 'Apache-2.0']), { used: 'Apache-2.0', offered: ['EPL-1.0'] });
  assert.deepEqual(chooseLicense(['EPL-2.0', 'GPL-2.0-with-classpath-exception']), {
    used: 'EPL-2.0',
    offered: ['GPL-2.0-with-classpath-exception'],
  });
});

test('SPDX expressions choose the permissive alternative of an OR and keep an AND whole', () => {
  assert.deepEqual(chooseFromExpression('(AFL-2.1 OR BSD-3-Clause)'), { used: 'BSD-3-Clause', offered: ['AFL-2.1'] });
  assert.deepEqual(chooseFromExpression('(Apache-2.0 AND BSD-3-Clause)'), { used: 'Apache-2.0 and BSD-3-Clause', offered: [] });
  assert.deepEqual(chooseFromExpression('MPL-2.0'), { used: 'MPL-2.0', offered: [] });
});

test('the document lists the libraries that are not permissive and the tools outside the list', () => {
  const text = render(
    parseMavenLicenses(XML),
    [{ name: 'three', versions: ['0.1'], license: 'MIT' }],
    [
      { name: 'axe-core', versions: ['4'], license: 'MPL-2.0' },
      { name: 'rxjs', versions: ['7'], license: 'Apache-2.0' },
    ],
  );
  assert.match(text, /\| jakarta\.x:api \| 2 \| EPL-2\.0 \|/);
  assert.match(text, /\| axe-core \| 4 \| MPL-2\.0 \|/);
  assert.doesNotMatch(text, /\| rxjs \| 7 \|/);
  assert.match(text, /\| three \| 0\.1 \| MIT \|/);
});
