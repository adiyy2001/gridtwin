package dev.gridtwin.domain.topology;

public final class UnionFind {

    private final int[] parent;
    private final int[] size;
    private int components;

    public UnionFind(int count) {
        this.parent = new int[count];
        this.size = new int[count];
        for (int index = 0; index < count; index++) {
            this.parent[index] = index;
            this.size[index] = 1;
        }
        this.components = count;
    }

    public int find(int element) {
        int root = element;
        while (this.parent[root] != root) {
            root = this.parent[root];
        }
        int current = element;
        while (this.parent[current] != root) {
            int next = this.parent[current];
            this.parent[current] = root;
            current = next;
        }
        return root;
    }

    public boolean union(int first, int second) {
        int firstRoot = this.find(first);
        int secondRoot = this.find(second);
        if (firstRoot == secondRoot) {
            return false;
        }
        if (this.size[firstRoot] < this.size[secondRoot]) {
            this.parent[firstRoot] = secondRoot;
            this.size[secondRoot] += this.size[firstRoot];
        } else {
            this.parent[secondRoot] = firstRoot;
            this.size[firstRoot] += this.size[secondRoot];
        }
        this.components--;
        return true;
    }

    public boolean connected(int first, int second) {
        return this.find(first) == this.find(second);
    }

    public int components() {
        return this.components;
    }
}
