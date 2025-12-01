export class CollectionManager {
    private collections: any[] = [];

    addCollection(collection: any): void {
        this.collections.push(collection);
    }
}
