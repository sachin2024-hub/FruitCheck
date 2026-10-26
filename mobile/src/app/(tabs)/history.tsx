import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScanRow } from '@/components/scan';
import { ConfirmDelete, ScanMenu } from '@/components/scan-menu';
import { Banner, Button, Chip, Empty } from '@/components/ui';
import { deleteScan, listScans, PAGE_SIZE, signedPhotoUrls, type HistoryFilter } from '@/lib/history';
import { FRUITS, type FruitSlug, type Ripeness } from '@/lib/labels';
import type { ScanRecord } from '@/lib/supabase';
import { colors, radius, space, type } from '@/lib/theme';

export default function History() {
  const [search, setSearch] = useState('');
  const [fruit, setFruit] = useState<FruitSlug | null>(null);
  const [ripeness, setRipeness] = useState<Ripeness | null>(null);
  const [rows, setRows] = useState<ScanRecord[] | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const [menuFor, setMenuFor] = useState<ScanRecord | null>(null);
  const [confirmFor, setConfirmFor] = useState<ScanRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filter: HistoryFilter = { fruit, ripeness, search };
  const filtered = !!(fruit || ripeness || search.trim());

  const load = useCallback(
    async (f: HistoryFilter) => {
      const id = ++request.current;
      try {
        const data = await listScans(f, 0);
        if (id !== request.current) return; // a newer filter is already loading
        setRows(data);
        setPage(0);
        setHasMore(data.length === PAGE_SIZE);
        setError(null);
        const urls = await signedPhotoUrls(data.map((r) => r.image_path));
        if (id === request.current) setPhotos(urls);
      } catch (e) {
        if (id === request.current) {
          setError((e as Error).message);
          setRows((r) => r ?? []);
        }
      }
    },
    [],
  );

  // Reloads when the tab regains focus (e.g. after a scan or a delete) and, debounced,
  // whenever the filters change while it is focused.
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => load({ fruit, ripeness, search }), 250);
      return () => clearTimeout(t);
    }, [fruit, ripeness, search, load]),
  );

  const loadMore = async () => {
    if (!hasMore || loadingMore || !rows) return;
    setLoadingMore(true);
    try {
      const next = await listScans(filter, page + 1);
      setRows([...rows, ...next]);
      setPage(page + 1);
      setHasMore(next.length === PAGE_SIZE);
      const urls = await signedPhotoUrls(next.map((r) => r.image_path));
      setPhotos((p) => ({ ...p, ...urls }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmFor || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteScan(confirmFor);
      const gone = confirmFor.id;
      setRows((r) => r?.filter((x) => x.id !== gone) ?? r);
      setConfirmFor(null);
      // Paging is offset-based, so a removed row would make the next page skip one; reload from the top.
      if (hasMore) load(filter);
    } catch (e) {
      console.log('[FruitCheck] Delete failed:', (e as Error).message);
      setDeleteError('Could not delete this scan. Check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  };

  const clear = () => {
    setSearch('');
    setFruit(null);
    setRipeness(null);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={styles.header}>
        <Text style={type.display}>History</Text>
        <View style={styles.search}>
          <Ionicons name="search" size={20} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search, e.g. ripe mango"
            placeholderTextColor="#9AA59C"
            style={styles.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search scans"
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')} hitSlop={10} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All fruits" active={!fruit} onPress={() => setFruit(null)} />
          {FRUITS.map((f) => (
            <Chip key={f.slug} label={f.name} active={fruit === f.slug} onPress={() => setFruit(fruit === f.slug ? null : f.slug)} />
          ))}
          <View style={styles.divider} />
          <Chip label="Ripe" active={ripeness === 'ripe'} onPress={() => setRipeness(ripeness === 'ripe' ? null : 'ripe')} />
          <Chip label="Unripe" active={ripeness === 'unripe'} onPress={() => setRipeness(ripeness === 'unripe' ? null : 'unripe')} />
        </ScrollView>
      </View>

      {rows === null ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load(filter);
            setRefreshing(false);
          }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            error ? (
              <Banner tone="error" text={error} action={<Button variant="secondary" label="Retry" onPress={() => load(filter)} />} />
            ) : undefined
          }
          ListEmptyComponent={
            error ? undefined : filtered ? (
              <Empty
                icon="search"
                title="No matching scans"
                text="Try a different search or clear the filters."
                action={<Button variant="secondary" label="Clear filters" onPress={clear} />}
              />
            ) : (
              <Empty
                icon="leaf-outline"
                title="No scans yet"
                text="Scan an apple, banana or mango and your results will be saved here."
                action={<Button label="Scan a Fruit" icon="camera" onPress={() => router.push('/scan')} />}
              />
            )
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ margin: space.md }} /> : null}
          renderItem={({ item }) => (
            <ScanRow
              scan={item}
              photo={item.image_path ? photos[item.image_path] : undefined}
              onPress={() => router.push({ pathname: '/record/[id]', params: { id: item.id } })}
              onMenu={() => setMenuFor(item)}
            />
          )}
        />
      )}

      <ScanMenu
        visible={!!menuFor}
        onClose={() => setMenuFor(null)}
        onView={() => {
          const id = menuFor?.id;
          setMenuFor(null);
          if (id) router.push({ pathname: '/record/[id]', params: { id } });
        }}
        onDelete={() => {
          setConfirmFor(menuFor);
          setDeleteError(null);
          setMenuFor(null);
        }}
      />
      <ConfirmDelete
        visible={!!confirmFor}
        busy={deleting}
        error={deleteError}
        onCancel={() => setConfirmFor(null)}
        onConfirm={confirmDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 10 },
  chips: { gap: space.sm, paddingBottom: space.sm, alignItems: 'center' },
  divider: { width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: space.lg, paddingTop: space.sm, gap: space.sm, flexGrow: 1 },
});
