# AI Commit - Feature Roadmap

Bu dosya, AI Commit VS Code extension'ı için planlanan yeni özellikleri ve geliştirme fırsatlarını içerir.

## 📊 **Sistem Analizi Özeti**

**Mevcut Güçlü Yönler:**
- ✅ Çoklu AI provider desteği (OpenAI + Gemini)
- ✅ Conventional Commits standardına uygunluk
- ✅ Gitmoji desteği
- ✅ 19 dil desteği
- ✅ Tam prompt özelleştirme
- ✅ Temiz modüler architecture
- ✅ TypeScript ile tip güvenliği

**Geliştirme Alanları:**
- ❌ Test coverage eksikliği
- ❌ Tek commit mesajı önerisi
- ❌ Sadece staged changes analizi
- ❌ Debugging araçları yetersiz

---

## 🚀 **YÜKSEK ÖNCELİK**

### 1. **Çoklu Commit Mesajı Önerileri**
**Açıklama:** Kullanıcıya 3 farklı commit mesajı alternatifi sunar  
**Teknik Detay:**
```typescript
// Kullanıcıya 3 farklı alternatif sunar
const suggestions = await generateMultipleCommitMessages(diff, 3);
const selected = await vscode.window.showQuickPick(suggestions);
```
**Faydası:** Kullanıcı deneyimini büyük oranda geliştirir  
**Zorluk:** ⭐⭐⭐ (Orta)

### 2. **Anthropic Claude Desteği**
**Açıklama:** Claude'u üçüncü AI provider olarak ekle  
**Teknik Detay:**
- `claude-3-5-sonnet`, `claude-3-opus` model desteği
- Anthropic API entegrasyonu
- Configuration settings genişletme
```typescript
// claude-utils.ts dosyası oluştur
export async function createClaudeClient(): Promise<Anthropic> {
  const apiKey = configManager.getConfig<string>('CLAUDE_API_KEY');
  return new Anthropic({ apiKey });
}
```
**Faydası:** Daha fazla AI seçeneği = daha iyi sonuçlar  
**Zorluk:** ⭐⭐⭐ (Orta)

### 3. **Commit Geçmişi Analizi**
**Açıklama:** Son commit'leri analiz ederek proje stilini öğrenir  
**Teknik Detay:**
```typescript
// Son N commit'i analiz ederek pattern öğrenir
const recentCommits = await getRecentCommits(10);
const style = analyzeCommitStyle(recentCommits);
// Bu style'a uygun mesaj üret
```
**Faydası:** Projeye özgü commit pattern'lerini takip eder  
**Zorluk:** ⭐⭐⭐⭐ (Zor)

---

## 🔧 **ORTA ÖNCELİK**

### 4. **İnteraktif Mod**
**Açıklama:** AI'ın belirsiz kaldığı konularda kullanıcıya soru sorması  
**Teknik Detay:**
```typescript
// AI'ın belirsiz kaldığı konularda soru sorması
const clarification = await vscode.window.showInputBox({
  prompt: "Bu değişiklik 'feat' mi 'fix' mi? Hangi component'i etkiliyor?"
});
```
**Faydası:** Daha isabetli commit mesajları  
**Zorluk:** ⭐⭐⭐⭐ (Zor)

### 5. **Pull Request Açıklama Üretici**
**Açıklama:** Branch'taki tüm commit'leri analiz edip PR açıklaması üretir  
**Teknik Detay:**
```typescript
// Branch'taki tüm commit'leri analiz edip PR açıklaması
const branchCommits = await getBranchCommits('main..HEAD');
const prDescription = await generatePRDescription(branchCommits);
```
**Faydası:** PR workflow'unu hızlandırır  
**Zorluk:** ⭐⭐⭐ (Orta)

### 6. **Proje Bazlı Ayarlar**
**Açıklama:** Her proje için özel ayarlar (.ai-commit.json)  
**Teknik Detay:**
```typescript
// .ai-commit.json dosyası desteği
const projectConfig = await readProjectConfig('.ai-commit.json');
const mergedConfig = { ...globalConfig, ...projectConfig };
```
**Faydası:** Takım standartlarını korur  
**Zorluk:** ⭐⭐ (Kolay)

---

## ⚡ **HIZLI ÇÖZÜMLER**

### 7. **Debug Output Channel**
**Açıklama:** Debugging için özel VS Code output channel'ı  
**Teknik Detay:**
```typescript
const outputChannel = vscode.window.createOutputChannel('AI Commit');
outputChannel.appendLine(`Prompt sent: ${prompt}`);
outputChannel.appendLine(`Response: ${response}`);
outputChannel.show();
```
**Faydası:** Sorun gidermeyi kolaylaştırır  
**Zorluk:** ⭐ (Çok Kolay)

### 8. **Unstaged Changes Desteği**
**Açıklama:** Staging area'ya almadan da commit mesajı üret  
**Teknik Detay:**
```typescript
// Staging area'ya almadan da commit mesajı üret
const unstagedDiff = await git.diff();
const commitMsg = await generateFromDiff(unstagedDiff);
```
**Faydası:** Workflow esnekliği  
**Zorluk:** ⭐⭐ (Kolay)

### 9. **Issue/Ticket Entegrasyonu**
**Açıklama:** Branch isminden ticket numarasını çıkarır  
**Teknik Detay:**
```typescript
// Branch isminden ticket numarasını çıkar
const branchName = await git.revparse(['--abbrev-ref', 'HEAD']);
const ticketMatch = branchName.match(/([A-Z]+-\d+)/);
if (ticketMatch) {
    commitMsg += `\n\nCloses ${ticketMatch[1]}`;
}
```
**Faydası:** Issue tracking otomasyonu  
**Zorluk:** ⭐⭐ (Kolay)

---

## 🎯 **GELECEK İÇİN**

### 10. **Git Hooks Entegrasyonu**
**Açıklama:** Otomatik commit-msg hook kurulumu  
**Teknik Detay:**
- Pre-commit validation
- Commit message format kontrolü
- Otomatik hook dosyası oluşturma

### 11. **Commit Template Sistemi**
**Açıklama:** Farklı proje türleri için hazır template'ler  
**Template Örnekleri:**
- Angular style: `feat(component): add new feature`
- React style: `✨ Add LoginButton component`
- API style: `feat(api): POST /users endpoint`

### 12. **Analytics & Learning**
**Açıklama:** Kullanıcı tercihlerinden öğrenen sistem  
**Özellikler:**
- Kabul/red edilen mesajları takip et
- Kullanıcı stilini öğren
- Zamanla daha iyi öneriler sun

---

## 🔨 **Teknik İyileştirmeler**

### Test Coverage
- Unit testler (`src/test/` klasörü)
- Integration testler
- CI/CD pipeline

### Performance
- API response caching
- Debounced diff analysis
- Background processing

### Error Handling
- Retry mechanism for API calls
- Offline mode support
- Better error messages

---

## 📈 **Geliştirme Sırası Önerisi**

1. **Debug Output Channel** (1 gün) - Hemen debugging'i iyileştirir
2. **Çoklu Commit Önerileri** (3 gün) - En çok talep edilecek özellik
3. **Claude Desteği** (2 gün) - Rekabet avantajı
4. **Unstaged Changes** (1 gün) - Workflow iyileştirmesi
5. **Issue Entegrasyonu** (2 gün) - Otomasyon değeri yüksek
6. **PR Açıklama Üretici** (4 gün) - Advanced feature

**Toplam süre:** ~2 hafta yoğun geliştirme

---

## 💡 **Ek Fikirler**

- **Commit mesajı preview:** Göndermeden önce önizleme
- **Shortcut tuşları:** Hızlı erişim için keyboard shortcuts
- **Commit statistics:** Aylık commit analizi ve raporlama
- **Team sharing:** Takım ayarlarını paylaşma
- **Commit templates:** Sık kullanılan mesaj template'leri