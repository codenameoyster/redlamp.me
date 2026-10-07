import { useCallback, useEffect, useState } from 'react';
import { api, message } from './api';

export function useResource<T>(path: string | null) {
	const [result, setResult] = useState<{ path: string; value: T } | null>(null);
	const [error, setError] = useState('');
	const [version, setVersion] = useState(0);
	const reload = useCallback(() => setVersion(value => value + 1), []);
	useEffect(() => {
		const controller = new AbortController();
		setError('');
		if (path) api<T>(path, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setResult({ path, value }); }).catch(error => { if (!controller.signal.aborted) setError(message(error)); });
		return () => controller.abort();
	}, [path, version]);
	return { data: result?.path === path ? result.value : null, error, reload, setData: (value: T) => { if (path) setResult({ path, value }); } };
}
