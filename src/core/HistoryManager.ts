export class HistoryManager {
    private history: any[] = [];

    addToHistory(item: any): void {
        this.history.push(item);
    }
}
