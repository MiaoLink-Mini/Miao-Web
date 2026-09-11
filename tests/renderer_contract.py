"""Pure assertions shared by browser verification and offline unit tests."""
def validate_renderer(observed, expected='auto'):
    if expected not in {'auto', 'three', 'fallback'}:
        raise ValueError('Unknown renderer expectation')
    if observed not in {'three', 'fallback'}:
        raise AssertionError('Renderer did not reach a usable state: ' + str(observed))
    if expected != 'auto' and observed != expected:
        raise AssertionError('Expected ' + expected + ', got ' + observed)
    return observed

def assert_frame_progress(before, after, advancing):
    if not isinstance(before, int) or not isinstance(after, int) or before < 1 or after < 1:
        raise AssertionError('Missing successful-render frame counters')
    if advancing and after <= before:
        raise AssertionError('Animation did not produce another rendered frame')
    if not advancing and after != before:
        raise AssertionError('Rendered frames advanced while animation should be stopped')
