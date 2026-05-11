import { StyleSheet } from 'react-native';

export const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0a0e1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4a5568' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0e1a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2035' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1e2a45' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#243450' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1526' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },

    searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#131929', marginHorizontal: 16, marginVertical: 8,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingHorizontal: 8 },

  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  locationBtn: {
    position: 'absolute', right: 16, bottom: 16,
    backgroundColor: '#131929', borderRadius: 20,
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    elevation: 4,
  },

  markerContainer: {
    backgroundColor: '#131929', borderRadius: 20, borderWidth: 2,
    borderColor: '#2a3550', padding: 6, alignItems: 'center', minWidth: 52,
  },
  markerSelected: { borderColor: '#f5c518', backgroundColor: '#1e2a45' },
  markerCount: { color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 2 },

  card: {
    backgroundColor: '#131929', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 8,
  },
  cardHandle: {
    width: 40, height: 4, backgroundColor: '#2a3550',
    borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 12,
  },
  cardContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  cardIconBox: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: '#f5c518', alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  cardInfo: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardVs: { color: '#f5c518' },
  cardLocation: { color: '#8896aa', fontSize: 12 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  cardMetaText: { color: '#8896aa', fontSize: 12 },
  openBadge: {
    backgroundColor: '#0d2a1a', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  openBadgeText: { color: '#2ecc71', fontSize: 11, fontWeight: '600' },
  cardArrow: { padding: 8 },

  bottomNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: '#131929', paddingVertical: 10, paddingHorizontal: 32,
    borderTopWidth: 1, borderTopColor: '#1e2a45',
  },
  navItem: { alignItems: 'center' },
  navLabel: { color: '#4a5568', fontSize: 11, marginTop: 2 },
  navLabelActive: { color: '#f5c518', fontSize: 11, marginTop: 2, fontWeight: '700' },
  fabBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#f5c518', alignItems: 'center', justifyContent: 'center',
    elevation: 6, marginBottom: 8,
  },
});
