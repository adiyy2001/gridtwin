package dev.gridtwin.domain.topology;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class UnionFindTest {

    @Test
    void everyElementStartsAlone() {
        UnionFind unionFind = new UnionFind(4);

        assertThat(unionFind.components()).isEqualTo(4);
        assertThat(unionFind.connected(0, 1)).isFalse();
    }

    @Test
    void unionJoinsComponentsAndReportsWhetherAnythingChanged() {
        UnionFind unionFind = new UnionFind(5);

        assertThat(unionFind.union(0, 1)).isTrue();
        assertThat(unionFind.union(1, 2)).isTrue();
        assertThat(unionFind.union(0, 2)).isFalse();

        assertThat(unionFind.connected(0, 2)).isTrue();
        assertThat(unionFind.connected(0, 3)).isFalse();
        assertThat(unionFind.components()).isEqualTo(3);
    }

    @Test
    void unionBySizeKeepsTheLargerRoot() {
        UnionFind unionFind = new UnionFind(6);
        unionFind.union(0, 1);
        unionFind.union(0, 2);
        int largeRoot = unionFind.find(0);

        unionFind.union(4, 0);
        unionFind.union(3, 5);
        unionFind.union(5, 0);

        assertThat(unionFind.find(4)).isEqualTo(largeRoot);
        assertThat(unionFind.find(3)).isEqualTo(largeRoot);
        assertThat(unionFind.components()).isEqualTo(1);
    }

    @Test
    void findCompressesLongChains() {
        UnionFind unionFind = new UnionFind(200);
        for (int element = 1; element < 200; element++) {
            unionFind.union(element - 1, element);
        }

        assertThat(unionFind.find(199)).isEqualTo(unionFind.find(0));
        assertThat(unionFind.components()).isEqualTo(1);
    }
}
