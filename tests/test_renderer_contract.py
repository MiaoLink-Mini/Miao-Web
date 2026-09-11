import unittest
from renderer_contract import validate_renderer, assert_frame_progress

class RendererContractTests(unittest.TestCase):
    def test_auto_accepts_either_working_renderer(self):
        for mode in ['three', 'fallback']: self.assertEqual(validate_renderer(mode), mode)
    def test_three_requirement_never_accepts_fallback(self):
        with self.assertRaises(AssertionError): validate_renderer('fallback', 'three')
    def test_fallback_requirement_never_accepts_three(self):
        with self.assertRaises(AssertionError): validate_renderer('three', 'fallback')
    def test_uninitialized_state_never_counts_as_success(self):
        for mode in [None, 'loading', '']:
            with self.assertRaises(AssertionError): validate_renderer(mode)
    def test_pause_and_motion_compare_actual_successful_frame_counts(self):
        assert_frame_progress(3, 3, False); assert_frame_progress(3, 4, True)
        with self.assertRaises(AssertionError): assert_frame_progress(3, 4, False)
        with self.assertRaises(AssertionError): assert_frame_progress(3, 3, True)
        with self.assertRaises(AssertionError): assert_frame_progress(0, 0, False)

if __name__ == '__main__': unittest.main()
